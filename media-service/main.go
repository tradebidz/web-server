package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/smtp"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	_ "golang.org/x/image/webp"
	"golang.org/x/text/language"
	"golang.org/x/text/message"
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

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"}, // Port của frontend
		AllowMethods:     []string{"POST", "GET", "OPTIONS", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.MaxMultipartMemory = 8 << 20 // 8MB

	r.POST("api/v1/media/upload", func(c *gin.Context) {
		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File is required"})
			return
		}
		defer file.Close()

		ext := strings.ToLower(filepath.Ext(header.Filename))
		fmt.Printf("File extension: %s\n", ext)
		if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Only JPG/PNG images are allowed"})
			return
		}

		// Processing Image
		if _, err := file.Seek(0, 0); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset file pointer"})
			return
		}

		srcImage, err := imaging.Decode(file)
		if err != nil {
			fmt.Printf("Image Decode Error: %v\n", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode image: %v", err)})
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
			fmt.Printf("Supabase Upload Error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to upload image to Supabase: %v", err)})
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
	supabaseKey := os.Getenv("SUPABASE_SERVICE_KEY")
	bucketName := os.Getenv("SUPABASE_BUCKET")

	uploadUrl := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseUrl, bucketName, filename)
	fmt.Printf("Uploading %s to %s\n", filename, uploadUrl)

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
			fmt.Printf("Redis XReadGroup Error: %v\n", err)
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
					productId, _ := values["product_id"].(string)
					newPrice, _ := values["new_price"].(string)
					sellerEmail, _ := values["seller_email"].(string)
					bidderEmail, _ := values["bidder_email"].(string)
					prevBidderEmail, _ := values["prev_bidder_email"].(string)
					fmt.Printf("Sending bid placed notifications for %s...\n", productName)

					err := sendBidPlacedEmail(sellerEmail, bidderEmail, prevBidderEmail, productName, newPrice, productId)
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

					// New Fields
					productId, _ := values["product_id"].(string)
					sellerName, _ := values["seller_name"].(string)
					winnerName, _ := values["winner_name"].(string)
					winnerAddress, _ := values["winner_address"].(string)

					fmt.Printf("Sending auction success emails for %s...\n", productName)

					err := sendAuctionSuccessEmail(sellerEmail, winnerEmail, productName, price, productId, sellerName, winnerName, winnerAddress)
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
				case "DESCRIPTION_UPDATE":
					productName, _ := values["product_name"].(string)
					description, _ := values["description"].(string)
					emailsJson, _ := values["emails"].(string)
					productUrl, _ := values["product_url"].(string)

					var emails []string
					err := json.Unmarshal([]byte(emailsJson), &emails)
					if err != nil {
						fmt.Printf("Failed to parse emails array: %v\n", err)
					} else {
						fmt.Printf("Sending description update notification to %d bidders...\n", len(emails))
						err = sendDescriptionUpdateEmail(emails, productName, description, productUrl)
						if err != nil {
							fmt.Printf("Failed to send description update emails: %v\n", err)
						}
					}
				}

				rdb.XAck(ctx, "notification_stream", "email_workers", msg.ID)
			}
		}
	}
}

// --- HELPER FUNCTION ---
func formatCurrencyVND(amountStr string) string {
	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil {
		return amountStr + " đ"
	}
	p := message.NewPrinter(language.Vietnamese)
	return p.Sprintf("%.0f đ", amount)
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
	subject := "Xác thực Email - Mã OTP của bạn"
	html := fmt.Sprintf(`
		<html>
		<body>
			<h2>Xác thực Email</h2>
			<p>Mã OTP của bạn là: <strong>%s</strong></p>
			<p>Mã này sẽ hết hạn trong 10 phút.</p>
			<p>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
		</body>
		</html>
	`, otp)

	return sendEmailViaGmail(to, subject, html)
}

func sendResetPasswordEmail(to string, otp string) error {
	subject := "Đặt lại mật khẩu - Mã OTP của bạn"
	html := fmt.Sprintf(`
		<html>
		<body>
			<h2>Yêu cầu đặt lại mật khẩu</h2>
			<p>Bạn đã yêu cầu đặt lại mật khẩu của mình.</p>
			<p>Mã OTP của bạn là: <strong>%s</strong></p>
			<p>Mã này sẽ hết hạn trong 10 phút.</p>
			<p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
		</body>
		</html>
	`, otp)

	return sendEmailViaGmail(to, subject, html)
}

func sendBidPlacedEmail(sellerEmail, bidderEmail, prevBidderEmail, productName, newPrice, productId string) error {
	baseUrl := "http://localhost:5173"
	formattedPrice := formatCurrencyVND(newPrice)

	// 1. Send to Seller
	sellerSubject := "Giá thầu mới cho sản phẩm của bạn"
	sellerHtml := fmt.Sprintf(`
		<html>
		<body>
			<h2>Đã nhận được giá thầu mới!</h2>
			<p>Tin tuyệt vời! Một giá thầu mới đã được đặt cho sản phẩm của bạn: <strong>%s</strong></p>
			<p>Số tiền thầu mới: <strong>%s</strong></p>
			<p>Đăng nhập vào tài khoản của bạn để xem chi tiết người đấu giá và quản lý phiên đấu giá.</p>
		</body>
		</html>
	`, productName, formattedPrice)
	if err := sendEmailViaGmail(sellerEmail, sellerSubject, sellerHtml); err != nil {
		fmt.Printf("Error sending to seller: %v\n", err) // Log but continue
	}

	// 2. Send to Current Bidder
	bidderSubject := "Xác nhận đấu giá - " + productName
	bidderHtml := fmt.Sprintf(`
		<html>
		<body>
			<h2>Đặt giá thầu thành công!</h2>
			<p>Bạn đã đặt giá thầu thành công cho sản phẩm: <strong>%s</strong></p>
			<p>Số tiền thầu của bạn: <strong>%s</strong></p>
			<p>Hiện bạn là người trả giá cao nhất. Chúng tôi sẽ thông báo nếu có ai đó trả giá cao hơn bạn.</p>
			<p>Chúc bạn may mắn!</p>
		</body>
		</html>
	`, productName, formattedPrice)
	if err := sendEmailViaGmail(bidderEmail, bidderSubject, bidderHtml); err != nil {
		fmt.Printf("Error sending to bidder: %v\n", err)
	}

	// 3. Send to Previous Bidder (if exists)
	if prevBidderEmail != "" {
		prevSubject := "Bạn đã bị vượt giá - " + productName
		prevHtml := fmt.Sprintf(`
			<html>
			<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
				<h2 style="color: #dc3545;">⚠️ Bạn đã bị vượt giá</h2>
				<p>Ai đó đã đặt giá cao hơn cho sản phẩm: <strong>%s</strong></p>
				<p>Giá thầu cao nhất hiện tại: <strong style="color: #dc3545; font-size: 1.2em;">%s</strong></p>
				<p>Đừng bỏ lỡ! Hãy đặt giá cao hơn để tiếp tục tham gia.</p>
				
				<p style="text-align: center; margin-top: 20px;">
					<a href="%s/product/%s" style="background-color: #ffc107; color: #333; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">🔥 Đấu giá lại ngay</a>
				</p>
			</body>
			</html>
		`, productName, formattedPrice, baseUrl, productId)
		if err := sendEmailViaGmail(prevBidderEmail, prevSubject, prevHtml); err != nil {
			fmt.Printf("Error sending to prev bidder: %v\n", err)
		}
	}

	return nil
}

func sendBidRejectedEmail(bidderEmail, productName, reason string) error {
	subject := "Giá thầu bị từ chối - " + productName
	html := fmt.Sprintf(`
		<html>
		<body>
			<h2>Giá thầu bị từ chối</h2>
			<p>Rất tiếc, giá thầu của bạn cho sản phẩm <strong>%s</strong> đã bị người bán từ chối.</p>
			<p>Lý do: <em>%s</em></p>
			<p>Chúng tôi xin lỗi vì sự bất tiện này. Vui lòng tham khảo các phiên đấu giá khác trên TradeBidz.</p>
		</body>
		</html>
	`, productName, reason)

	return sendEmailViaGmail(bidderEmail, subject, html)
}

func sendAuctionSuccessEmail(sellerEmail, winnerEmail, productName, price, productId, sellerName, winnerName, winnerAddress string) error {
	// Base URL for links (adjust port if needed, assuming default Vite port)
	baseUrl := "http://localhost:5173"
	formattedPrice := formatCurrencyVND(price)

	// 1. Send to Seller
	sellerSubject := "Hành động cần thiết: Đấu giá thành công - " + productName
	sellerHtml := fmt.Sprintf(`
		<html>
		<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
			<h2 style="color: #28a745;">🎉 Đấu giá thành công!</h2>
			<p>Chúc mừng! Phiên đấu giá cho sản phẩm <strong>%s</strong> của bạn đã kết thúc thành công.</p>
			
			<div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
				<h3 style="margin-top: 0;">Chi tiết giao dịch</h3>
				<p><strong>Giá cuối cùng:</strong> <span style="font-size: 1.2em; color: #dc3545;">%s</span></p>
				<hr style="border: 0; border-top: 1px solid #dee2e6;">
				<h3 style="margin-top: 10px;">Thông tin người thắng</h3>
				<p><strong>Tên:</strong> %s</p>
				<p><strong>Email:</strong> <a href="mailto:%s">%s</a></p>
				<p><strong>Địa chỉ:</strong> %s</p>
			</div>

			<p>Vui lòng liên hệ với người thắng để sắp xếp thanh toán và giao hàng, hoặc nhấp vào liên kết bên dưới để xem chi tiết đơn hàng.</p>
			
			<p style="text-align: center;">
				<a href="%s/product/%s" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Order Details</a>
			</p>
		</body>
		</html>
	`, productName, formattedPrice, winnerName, winnerEmail, winnerEmail, winnerAddress, baseUrl, productId)

	if err := sendEmailViaGmail(sellerEmail, sellerSubject, sellerHtml); err != nil {
		fmt.Printf("Error sending to seller: %v\n", err)
	}

	// 2. Send to Winner
	winnerSubject := "Bạn đã thắng! Hoàn tất đơn hàng cho " + productName
	winnerHtml := fmt.Sprintf(`
		<html>
		<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
			<h2 style="color: #ffc107;">🏆 Bạn đã thắng phiên đấu giá!</h2>
			<p>Chúc mừng! Bạn là người chiến thắng phiên đấu giá cho sản phẩm <strong>%s</strong>.</p>
			
			<div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
				<h3 style="margin-top: 0;">Giá thầu chiến thắng</h3>
				<p><strong>Số tiền:</strong> <span style="font-size: 1.2em; color: #dc3545;">%s</span></p>
				<hr style="border: 0; border-top: 1px solid #dee2e6;">
				<h3 style="margin-top: 10px;">Thông tin người bán</h3>
				<p><strong>Tên:</strong> %s</p>
				<p><strong>Email:</strong> <a href="mailto:%s">%s</a></p>
			</div>

			<p>Vui lòng hoàn tất đơn hàng bằng cách liên hệ với người bán hoặc tiến hành thanh toán.</p>
			
			<p style="text-align: center;">
				<a href="%s/product/%s" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Hoàn tất đơn hàng ngay</a>
			</p>
		</body>
		</html>
	`, productName, formattedPrice, sellerName, sellerEmail, sellerEmail, baseUrl, productId)

	if err := sendEmailViaGmail(winnerEmail, winnerSubject, winnerHtml); err != nil {
		fmt.Printf("Error sending to winner: %v\n", err)
	}

	return nil
}

func sendAuctionFailEmail(sellerEmail, productName string) error {
	subject := "Phiên đấu giá kết thúc - Không có người tham gia"
	html := fmt.Sprintf(`
		<html>
		<body>
			<h2>Phiên đấu giá đã kết thúc</h2>
			<p>Phiên đấu giá cho sản phẩm <strong>%s</strong> của bạn đã kết thúc.</p>
			<p>Rất tiếc, không có giá thầu nào được đặt trong thời gian đấu giá.</p>
			<p>Bạn có thể cân nhắc đăng lại sản phẩm với giá cả điều chỉnh hoặc mô tả chi tiết hơn để thu hút người mua.</p>
			<p>Cảm ơn bạn đã sử dụng TradeBidz!</p>
		</body>
		</html>
	`, productName)

	return sendEmailViaGmail(sellerEmail, subject, html)
}

func sendNewQuestionEmail(sellerEmail, productName, question, productUrl string) error {
	subject := "Câu hỏi mới về sản phẩm của bạn - " + productName
	html := fmt.Sprintf(`
		<html>
		<body>
			<h2>Đã nhận được câu hỏi mới</h2>
			<p>Một người mua tiềm năng đã đặt câu hỏi về sản phẩm của bạn: <strong>%s</strong></p>
			<p><strong>Câu hỏi:</strong></p>
			<p style="padding: 10px; background-color: #f5f5f5; border-left: 3px solid #007bff;">%s</p>
			<p>Vui lòng trả lời câu hỏi này để tăng sự tin tưởng của người mua và cải thiện cơ hội bán hàng thành công.</p>
			<p><a href="%s" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Xem sản phẩm & Trả lời</a></p>
		</body>
		</html>
	`, productName, question, productUrl)

	return sendEmailViaGmail(sellerEmail, subject, html)
}

func sendNewAnswerEmail(emails []string, productName, question, answer string) error {
	subject := "Người bán đã trả lời câu hỏi - " + productName

	for _, email := range emails {
		html := fmt.Sprintf(`
			<html>
			<body>
				<h2>Câu trả lời mới</h2>
				<p>Người bán đã trả lời một câu hỏi về <strong>%s</strong>, sản phẩm mà bạn đang quan tâm.</p>
				<p><strong>Câu hỏi:</strong></p>
				<p style="padding: 10px; background-color: #f5f5f5; border-left: 3px solid #007bff;">%s</p>
				<p><strong>Trả lời:</strong></p>
				<p style="padding: 10px; background-color: #e8f4f8; border-left: 3px solid #28a745;">%s</p>
				<p>Thông tin này có thể giúp bạn đưa ra quyết định đấu giá sáng suốt hơn.</p>
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

func sendDescriptionUpdateEmail(emails []string, productName, description, productUrl string) error {
	subject := "Cập nhật mô tả sản phẩm - " + productName

	for _, email := range emails {
		html := fmt.Sprintf(`
			<html>
			<body>
				<h2>Cập nhật mô tả</h2>
				<p>Người bán đã cập nhật mô tả cho <strong>%s</strong>, sản phẩm mà bạn đang quan tâm.</p>
				<p><strong>Mô tả mới:</strong></p>
				<p style="padding: 10px; background-color: #f5f5f5; border-left: 3px solid #ffc107;">%s</p>
				<p>Vui lòng xem lại mô tả cập nhật để đảm bảo nó đáp ứng mong đợi của bạn.</p>
				<p><a href="%s" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Xem sản phẩm</a></p>
			</body>
			</html>
		`, productName, description, productUrl)

		if err := sendEmailViaGmail(email, subject, html); err != nil {
			fmt.Printf("Failed to send description update email to %s: %v\n", email, err)
			continue
		}
		fmt.Printf("Description update email sent to %s\n", email)
	}

	return nil
}
