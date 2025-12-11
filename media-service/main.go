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
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
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

	for {
		streams, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    "email_workers",
			Consumer: "worker_1",
			Streams:  []string{"notification_stream", ">"},
			Count:    1,
			Block:    0,
		}).Result()

		if err != nil {
			continue
		}

		for _, stream := range streams {
			for _, msg := range stream.Messages {
				values := msg.Values
				msgType := values["type"].(string)
				email := values["email"].(string)

				if msgType == "VERIFY_EMAIL" {
					otp := values["otp"].(string)
					fmt.Printf("Sending OTP %s to %s...\n", otp, email)

					err := sendEmail(email, otp)
					if err != nil {
						fmt.Printf("Failed to send email to %s: %v\n", email, err)
					}
				}

				rdb.XAck(ctx, "notification_stream", "email_workers", msg.ID)
			}
		}
	}
}

func sendEmail(to string, otp string) error {
	// Mailtrap API configuration
	apiToken := os.Getenv("MAILTRAP_API_TOKEN")
	fromEmail := os.Getenv("FROM_EMAIL")
	fromName := os.Getenv("FROM_NAME")

	// Debug: Check if token is loaded
	if apiToken == "" {
		return fmt.Errorf("MAILTRAP_API_TOKEN is not set in environment variables")
	}
	fmt.Printf("Using API token: %s...%s (length: %d)\n", apiToken[:8], apiToken[len(apiToken)-4:], len(apiToken))

	if fromEmail == "" {
		fromEmail = "hello@demomailtrap.co"
	}
	if fromName == "" {
		fromName = "TradeBidz"
	}

	// Prepare email payload
	payload := map[string]interface{}{
		"from": map[string]string{
			"email": fromEmail,
			"name":  fromName,
		},
		"to": []map[string]string{
			{"email": to},
		},
		"subject": "Email Verification - Your OTP Code",
		"html": fmt.Sprintf(`
			<html>
			<body>
				<h2>Email Verification</h2>
				<p>Your OTP code is: <strong>%s</strong></p>
				<p>This code will expire in 10 minutes.</p>
				<p>If you did not request this code, please ignore this email.</p>
			</body>
			</html>
		`, otp),
		"category": "Email Verification",
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %v", err)
	}

	// Send request to Mailtrap API
	req, err := http.NewRequest("POST", "https://send.api.mailtrap.io/api/send", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Failed to send email to %s: %v\n", to, err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("mailtrap API error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	fmt.Printf("Email sent successfully to %s via Mailtrap\n", to)
	return nil
}
