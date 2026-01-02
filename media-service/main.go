package main

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/disintegration/imaging"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
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
