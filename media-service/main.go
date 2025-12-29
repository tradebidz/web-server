package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"net/http"
	"net/smtp"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

const (
	SMTPHost    = "smtp.gmail.com"
	SMTPPort    = "587"
	SenderEmail = "tradebidz8386@gmail.com"
	SenderName  = "TradeBidz"
)

func main() {
	_ = godotenv.Load()

	r := gin.Default()

	r.MaxMultipartMemory = 8 << 20 // 8MB

	r.POST("api/v1/media/upload", func(c *gin.Context) {
		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File is required"})
			return
		}
		defer file.Close()

		ext := strings.ToLower(filepath.Ext(header.Filename))
		if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Only JPG/PNG images are allowed"})
			return
		}

		// Processing Image
		srcImage, err := imaging.Decode(file)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to decode image"})
			return
		}

		var dstImage image.Image = srcImage
		if srcImage.Bounds().Dx() > 1024 {
			dstImage = imaging.Resize(srcImage, 1024, 0, imaging.Lanczos)
		}

		buf := new(bytes.Buffer)
		err = jpeg.Encode(buf, dstImage, &jpeg.Options{Quality: 80})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compress image"})
			return
		}

		cleanFileName := strings.ReplaceAll(header.Filename, " ", "-")
		finalFileName := fmt.Sprintf("%d_%s.jpg", time.Now().Unix(), strings.TrimSuffix(cleanFileName, ext))

		url, err := uploadBufferToSupabase(buf, finalFileName, "image/jpeg")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload image to Supabase"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"url":           url,
			"original_name": header.Filename,
			"processed":     true,
		})
	})

	go startEmailWorker()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server Golang running on port %s\n", port)
	r.Run(":" + port)
}

func uploadBufferToSupabase(body io.Reader, filename string, contentType string) (string, error) {
	supabaseUrl := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")
	bucketName := os.Getenv("SUPABASE_BUCKET")

	uploadUrl := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseUrl, bucketName, filename)

	req, err := http.NewRequest("PUT", uploadUrl, body)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+supabaseKey)
	req.Header.Set("Content-Type", contentType)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	publicUrl := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseUrl, bucketName, filename)
	return publicUrl, nil
}

func startEmailWorker() {
	ctx := context.Background()
	rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})

	rdb.XGroupCreateMkStream(ctx, "notification_stream", "email_workers", "$")

	fmt.Println("📧 Email Worker started with Gmail SMTP...")

	for {
		streams, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    "email_workers",
			Consumer: "worker_1",
			Streams:  []string{"notification_stream", ">"},
			Count:    1,
			Block:    0,
		}).Result()

		if err != nil {
			time.Sleep(1 * time.Second)
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				values := msg.Values
				msgType, ok := values["type"].(string)
				if !ok {
					fmt.Printf("Warning: 'type' field is missing or not a string\n")
					rdb.XAck(ctx, "notification_stream", "email_workers", msg.ID)
					continue
				}

				switch msgType {
				case "VERIFY_EMAIL":
					email, _ := values["email"].(string)
					otp, _ := values["otp"].(string)
					fmt.Printf("Sending verification OTP %s to %s...\n", otp, email)

					err := sendVerificationEmail(email, otp)
					if err != nil {
						fmt.Printf("Failed to send verification email to %s: %v\n", email, err)
					}
				case "RESET_PASSWORD":
					email, _ := values["email"].(string)
					otp, _ := values["otp"].(string)
					fmt.Printf("Sending password reset OTP %s to %s...\n", otp, email)

					err := sendResetPasswordEmail(email, otp)
					if err != nil {
						fmt.Printf("Failed to send reset password email to %s: %v\n", email, err)
					}
				case "BID_PLACED":
					productName, _ := values["product_name"].(string)
					newPrice, _ := values["new_price"].(string)
					sellerEmail, _ := values["seller_email"].(string)
					bidderEmail, _ := values["bidder_email"].(string)
					prevBidderEmail, _ := values["prev_bidder_email"].(string)
					fmt.Printf("Sending bid placed notifications for %s...\n", productName)

					err := sendBidPlacedEmail(sellerEmail, bidderEmail, prevBidderEmail, productName, newPrice)
					if err != nil {
						fmt.Printf("Failed to send bid placed emails: %v\n", err)
					}
				case "BID_REJECTED":
					productName, _ := values["product_name"].(string)
					bidderEmail, _ := values["bidder_email"].(string)
					reason, _ := values["reason"].(string)
					fmt.Printf("Sending bid rejection email to %s...\n", bidderEmail)

					err := sendBidRejectedEmail(bidderEmail, productName, reason)
					if err != nil {
						fmt.Printf("Failed to send bid rejected email: %v\n", err)
					}
				case "AUCTION_SUCCESS":
					productName, _ := values["product_name"].(string)
					price, _ := values["price"].(string)
					sellerEmail, _ := values["seller_email"].(string)
					winnerEmail, _ := values["winner_email"].(string)
					fmt.Printf("Sending auction success emails for %s...\n", productName)

					err := sendAuctionSuccessEmail(sellerEmail, winnerEmail, productName, price)
					if err != nil {
						fmt.Printf("Failed to send auction success emails: %v\n", err)
					}
				case "AUCTION_FAIL":
					productName, _ := values["product_name"].(string)
					sellerEmail, _ := values["seller_email"].(string)
					fmt.Printf("Sending auction fail email to %s...\n", sellerEmail)

					err := sendAuctionFailEmail(sellerEmail, productName)
					if err != nil {
						fmt.Printf("Failed to send auction fail email: %v\n", err)
					}
				case "NEW_QUESTION":
					productName, _ := values["product_name"].(string)
					sellerEmail, _ := values["seller_email"].(string)
					question, _ := values["question"].(string)
					productUrl, _ := values["product_url"].(string)
					fmt.Printf("Sending new question notification to %s...\n", sellerEmail)

					err := sendNewQuestionEmail(sellerEmail, productName, question, productUrl)
					if err != nil {
						fmt.Printf("Failed to send new question email: %v\n", err)
					}
				case "NEW_ANSWER":
					productName, _ := values["product_name"].(string)
					question, _ := values["question"].(string)
					answer, _ := values["answer"].(string)
					emailsJson, _ := values["emails"].(string)

					var emails []string
					err := json.Unmarshal([]byte(emailsJson), &emails)
					if err != nil {
						fmt.Printf("Failed to parse emails array: %v\n", err)
					} else {
						fmt.Printf("Sending new answer notification to %d bidders...\n", len(emails))
						err = sendNewAnswerEmail(emails, productName, question, answer)
						if err != nil {
							fmt.Printf("Failed to send new answer emails: %v\n", err)
						}
					}
				}

				rdb.XAck(ctx, "notification_stream", "email_workers", msg.ID)
			}
		}
	}
}

// --- SMTP HELPER FUNCTION ---

func sendEmailViaGmail(to string, subject string, htmlBody string) error {
	appPassword := os.Getenv("GMAIL_APP_PASSWORD")
	if appPassword == "" {
		return fmt.Errorf("GMAIL_APP_PASSWORD is not set")
	}

	auth := smtp.PlainAuth("", SenderEmail, appPassword, SMTPHost)
	headers := make(map[string]string)
	headers["From"] = fmt.Sprintf("%s <%s>", SenderName, SenderEmail)
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=\"UTF-8\""

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + htmlBody

	addr := fmt.Sprintf("%s:%s", SMTPHost, SMTPPort)

	err := smtp.SendMail(addr, auth, SenderEmail, []string{to}, []byte(message))
	if err != nil {
		return err
	}

	return nil
}

func sendVerificationEmail(to string, otp string) error {
	subject := "Email Verification - Your OTP Code"
	html := fmt.Sprintf(`
		<html>
		<body>
			<h2>Email Verification</h2>
			<p>Your OTP code is: <strong>%s</strong></p>
			<p>This code will expire in 10 minutes.</p>
			<p>If you did not request this code, please ignore this email.</p>
		</body>
		</html>
	`, otp)

	return sendEmailViaGmail(to, subject, html)
}

func sendResetPasswordEmail(to string, otp string) error {
	subject := "Password Reset - Your OTP Code"
	html := fmt.Sprintf(`
		<html>
		<body>
			<h2>Password Reset Request</h2>
			<p>You have requested to reset your password.</p>
			<p>Your OTP code is: <strong>%s</strong></p>
			<p>This code will expire in 10 minutes.</p>
			<p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
		</body>
		</html>
	`, otp)

	return sendEmailViaGmail(to, subject, html)
}

func sendBidPlacedEmail(sellerEmail, bidderEmail, prevBidderEmail, productName, newPrice string) error {
	// 1. Send to Seller
	sellerSubject := "New Bid Placed on Your Product"
	sellerHtml := fmt.Sprintf(`
		<html>
		<body>
			<h2>New Bid Received!</h2>
			<p>Great news! A new bid has been placed on your product: <strong>%s</strong></p>
			<p>New bid amount: <strong>$%s</strong></p>
			<p>Log in to your account to view the bidder details and manage your auction.</p>
		</body>
		</html>
	`, productName, newPrice)
	if err := sendEmailViaGmail(sellerEmail, sellerSubject, sellerHtml); err != nil {
		fmt.Printf("Error sending to seller: %v\n", err) // Log but continue
	}

	// 2. Send to Current Bidder
	bidderSubject := "Bid Confirmation - " + productName
	bidderHtml := fmt.Sprintf(`
		<html>
		<body>
			<h2>Bid Placed Successfully!</h2>
			<p>Your bid has been successfully placed on: <strong>%s</strong></p>
			<p>Your bid amount: <strong>$%s</strong></p>
			<p>You are currently the highest bidder. We'll notify you if someone outbids you.</p>
			<p>Good luck!</p>
		</body>
		</html>
	`, productName, newPrice)
	if err := sendEmailViaGmail(bidderEmail, bidderSubject, bidderHtml); err != nil {
		fmt.Printf("Error sending to bidder: %v\n", err)
	}

	// 3. Send to Previous Bidder (if exists)
	if prevBidderEmail != "" {
		prevSubject := "You've Been Outbid - " + productName
		prevHtml := fmt.Sprintf(`
			<html>
			<body>
				<h2>You've Been Outbid</h2>
				<p>Someone has placed a higher bid on: <strong>%s</strong></p>
				<p>New highest bid: <strong>$%s</strong></p>
				<p>Don't miss out! Place a higher bid to stay in the running.</p>
			</body>
			</html>
		`, productName, newPrice)
		if err := sendEmailViaGmail(prevBidderEmail, prevSubject, prevHtml); err != nil {
			fmt.Printf("Error sending to prev bidder: %v\n", err)
		}
	}

	return nil
}

func sendBidRejectedEmail(bidderEmail, productName, reason string) error {
	subject := "Bid Rejected - " + productName
	html := fmt.Sprintf(`
		<html>
		<body>
			<h2>Bid Rejected</h2>
			<p>Unfortunately, your bid on <strong>%s</strong> has been rejected by the seller.</p>
			<p>Reason: <em>%s</em></p>
			<p>We apologize for any inconvenience. Please feel free to browse other auctions on TradeBidz.</p>
		</body>
		</html>
	`, productName, reason)

	return sendEmailViaGmail(bidderEmail, subject, html)
}

func sendAuctionSuccessEmail(sellerEmail, winnerEmail, productName, price string) error {
	// 1. Send to Seller
	sellerSubject := "Congratulations! Your Auction Sold Successfully"
	sellerHtml := fmt.Sprintf(`
		<html>
		<body>
			<h2>🎉 Auction Successful!</h2>
			<p>Congratulations! Your auction for <strong>%s</strong> has ended successfully.</p>
			<p>Final sale price: <strong>$%s</strong></p>
			<p>The winning bidder will be contacted shortly. Please log in to your account to view the winner's details and complete the transaction.</p>
		</body>
		</html>
	`, productName, price)
	if err := sendEmailViaGmail(sellerEmail, sellerSubject, sellerHtml); err != nil {
		fmt.Printf("Error sending to seller: %v\n", err)
	}

	// 2. Send to Winner
	winnerSubject := "Congratulations! You Won the Auction"
	winnerHtml := fmt.Sprintf(`
		<html>
		<body>
			<h2>🏆 You Won!</h2>
			<p>Congratulations! You have won the auction for <strong>%s</strong>!</p>
			<p>Your winning bid: <strong>$%s</strong></p>
			<p>The seller will contact you shortly to arrange payment and delivery. Please log in to your account for more details.</p>
			<p>Thank you for using TradeBidz!</p>
		</body>
		</html>
	`, productName, price)
	if err := sendEmailViaGmail(winnerEmail, winnerSubject, winnerHtml); err != nil {
		fmt.Printf("Error sending to winner: %v\n", err)
	}

	return nil
}

func sendAuctionFailEmail(sellerEmail, productName string) error {
	subject := "Auction Ended - No Bids Received"
	html := fmt.Sprintf(`
		<html>
		<body>
			<h2>Auction Ended</h2>
			<p>Your auction for <strong>%s</strong> has ended.</p>
			<p>Unfortunately, no bids were received during this auction period.</p>
			<p>You can consider relisting the item with adjusted pricing or improved descriptions to attract more bidders.</p>
			<p>Thank you for using TradeBidz!</p>
		</body>
		</html>
	`, productName)

	return sendEmailViaGmail(sellerEmail, subject, html)
}

func sendNewQuestionEmail(sellerEmail, productName, question, productUrl string) error {
	subject := "New Question About Your Product - " + productName
	html := fmt.Sprintf(`
		<html>
		<body>
			<h2>New Question Received</h2>
			<p>A potential buyer has asked a question about your product: <strong>%s</strong></p>
			<p><strong>Question:</strong></p>
			<p style="padding: 10px; background-color: #f5f5f5; border-left: 3px solid #007bff;">%s</p>
			<p>Please answer this question to help increase buyer confidence and improve your chances of a successful sale.</p>
			<p><a href="%s" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Product & Answer Question</a></p>
		</body>
		</html>
	`, productName, question, productUrl)

	return sendEmailViaGmail(sellerEmail, subject, html)
}

func sendNewAnswerEmail(emails []string, productName, question, answer string) error {
	subject := "Seller Answered a Question - " + productName

	for _, email := range emails {
		html := fmt.Sprintf(`
			<html>
			<body>
				<h2>New Answer Posted</h2>
				<p>The seller has answered a question about <strong>%s</strong>, a product you're interested in.</p>
				<p><strong>Question:</strong></p>
				<p style="padding: 10px; background-color: #f5f5f5; border-left: 3px solid #007bff;">%s</p>
				<p><strong>Answer:</strong></p>
				<p style="padding: 10px; background-color: #e8f4f8; border-left: 3px solid #28a745;">%s</p>
				<p>This information may help you make a more informed bidding decision.</p>
			</body>
			</html>
		`, productName, question, answer)

		if err := sendEmailViaGmail(email, subject, html); err != nil {
			fmt.Printf("Failed to send answer email to %s: %v\n", email, err)
			continue
		}
		fmt.Printf("New answer email sent to %s\n", email)
	}

	return nil
}
