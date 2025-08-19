/**
 * BrowserImageGenerator - Uses Cloudflare Browser Rendering API to generate blog images
 * More reliable and flexible than Canvas API
 */

import puppeteer from '@cloudflare/puppeteer';

export interface GeneratedImage {
	filename: string;
	path: string;
	imageBase64: string;
}

// Category color schemes
const categoryColors = {
	'product-update': { primary: '#3b82f6', secondary: '#1d4ed8', accent: '#60a5fa' },
	'sales-and-marketing': { primary: '#10b981', secondary: '#047857', accent: '#34d399' },
	crm: { primary: '#8b5cf6', secondary: '#7c3aed', accent: '#a78bfa' },
	'product-support': { primary: '#f59e0b', secondary: '#d97706', accent: '#fbbf24' },
	grant: { primary: '#ef4444', secondary: '#dc2626', accent: '#f87171' },
	default: { primary: '#6b7280', secondary: '#4b5563', accent: '#9ca3af' },
};

export class BrowserImageGenerator {
	private browserBinding: Fetcher;
	private graphicsBucket: R2Bucket;

	constructor(browserBinding: Fetcher, graphicsBucket: R2Bucket) {
		this.browserBinding = browserBinding;
		this.graphicsBucket = graphicsBucket;
	}

	/**
	 * Generate blog image using Browser Rendering API
	 */
	async generateBlogImage(title: string, category: string, filename: string): Promise<GeneratedImage> {
		try {
			console.log(`🎨 Generating image with Browser API for: ${title}`);
			console.log(`📂 Category: ${category}`);

			// Get category colors
			const colors = categoryColors[category as keyof typeof categoryColors] || categoryColors.default;

			// Try to get background graphic from R2
			let backgroundImageDataUrl = '';
			try {
				const graphicFile = `${category}.png`;
				console.log(`🖼️  Loading background graphic: ${graphicFile}`);
				const r2Object = await this.graphicsBucket.get(graphicFile);
				if (r2Object) {
					const blob = await r2Object.blob();
					const arrayBuffer = await blob.arrayBuffer();

					// Check file size to prevent memory issues
					const sizeInMB = arrayBuffer.byteLength / 1024 / 1024;
					console.log(`📊 Background graphic size: ${sizeInMB.toFixed(2)} MB`);

					if (sizeInMB > 10) {
						console.log('⚠️  Background graphic too large, using gradient instead');
					} else {
						// Use a safer approach to convert to base64
						const uint8Array = new Uint8Array(arrayBuffer);
						let binaryString = '';
						const chunkSize = 32768; // Process in smaller chunks

						for (let i = 0; i < uint8Array.length; i += chunkSize) {
							const chunk = uint8Array.subarray(i, i + chunkSize);
							binaryString += String.fromCharCode.apply(null, Array.from(chunk));
						}

						const base64 = btoa(binaryString);
						backgroundImageDataUrl = `data:image/png;base64,${base64}`;
						console.log('✅ Background graphic loaded from R2');
					}
				}
			} catch (error) {
				console.log(`⚠️  Could not load background graphic, using gradient: ${error}`);
			}

			// Create HTML template for the blog image
			const htmlTemplate = this.createImageHTML(title, category, colors, backgroundImageDataUrl);

			// Launch browser and take screenshot
			const browser = await puppeteer.launch(this.browserBinding);
			const page = await browser.newPage();

			// Set viewport size for consistent image dimensions (smaller for smaller file size)
			await page.setViewport({ width: 800, height: 480 });

			// Set HTML content
			await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });

			// Take screenshot with aggressive compression
			const screenshot = (await page.screenshot({
				type: 'jpeg',
				quality: 40, // Reduced quality further to decrease file size
				fullPage: false,
			})) as Buffer;

			await browser.close();

			// Convert to base64 and check size
			const imageBase64 = screenshot.toString('base64');
			const sizeInKB = (imageBase64.length / 1024) * 0.75; // Approximate size in KB
			console.log(`📊 Generated image size: ${sizeInKB.toFixed(2)} KB`);

			// GitHub API has a payload limit, warn if getting close
			if (sizeInKB > 200) {
				console.log('⚠️  Generated image is quite large, might cause GitHub API issues');
			}

			// Generate filename
			const imageFilename = `${filename.replace('.mdx', '')}.jpg`;
			const imagePath = `docs/public/images/blog/${category}/${imageFilename}`;

			console.log(`✅ Image generated successfully: ${imageFilename}`);

			return {
				filename: imageFilename,
				path: imagePath,
				imageBase64,
			};
		} catch (error) {
			console.error('❌ Browser image generation failed:', error);
			throw error;
		}
	}

	/**
	 * Create HTML template for blog image
	 */
	private createImageHTML(
		title: string,
		category: string,
		colors: { primary: string; secondary: string; accent: string },
		backgroundImageDataUrl: string
	): string {
		const hasBackground = backgroundImageDataUrl.length > 0;

		return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            padding: 0;
            width: 800px;
            height: 480px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            overflow: hidden;
            position: relative;
        }
        
        .container {
            width: 100%;
            height: 100%;
            position: relative;
        }
        
        .background-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: 1;
        }
        
        .content {
            position: absolute;
            z-index: 3;
            color: white;
            left: 10%;
            top: 55%;
            transform: translateY(-50%);
            width: 50%;
            text-align: left;
        }
        
        .title {
            font-size: 32px;
            font-weight: 700;
            line-height: 1.2;
            margin: 0;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            word-wrap: break-word;
            hyphens: auto;
        }
        
        .brand {
            position: absolute;
            bottom: 30px;
            right: 40px;
            font-size: 16px;
            font-weight: 600;
            color: rgba(255,255,255,0.9);
            z-index: 3;
        }
    </style>
</head>
<body>
    <div class="container">
        ${hasBackground ? `<img src="${backgroundImageDataUrl}" class="background-image" alt="Background">` : ''}
        <div class="content">
            <h1 class="title">${this.escapeHtml(title)}</h1>
        </div>
        <div class="brand">Voltade Blog</div>
    </div>
</body>
</html>`;
	}

	/**
	 * Escape HTML characters to prevent XSS
	 */
	private escapeHtml(text: string): string {
		return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}
}
