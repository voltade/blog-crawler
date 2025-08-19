# Voltade Blog Crawler - Automated Blog Publishing System

## 🎯 What This Does

This system automatically finds new blog posts from Voltade's website and publishes them to the company blog with beautiful, branded images. It runs every day at 9 AM Singapore time without any manual work needed.

## 🔄 How It Works (Simple Overview)

1. **Finds New Content**: Every morning, the system checks Voltade's website for new blog posts
2. **Creates Beautiful Images**: Automatically generates branded images for each blog post using your uploaded graphics
3. **Publishes Everything**: Sends the blog post and image to your blog website automatically
4. **Keeps Track**: Remembers what it already published so it doesn't duplicate content

## 📊 Current Status

✅ **Fully Operational** - Running automatically every day  
✅ **Image Generation** - Creates branded images with your graphics  
✅ **Smart Categorization** - Automatically sorts posts into the right categories  
✅ **Size Optimized** - Images are compressed to load quickly on your website

## 🎨 Image Categories & Graphics

The system uses these pre-uploaded graphics for different blog post types:

| Category              | Graphic File              | Used For                                          |
| --------------------- | ------------------------- | ------------------------------------------------- |
| **Sales & Marketing** | `sales-and-marketing.png` | Sales tips, marketing strategies, lead generation |
| **Product Updates**   | `product-update.png`      | New features, product announcements, updates      |
| **CRM**               | `crm.png`                 | Customer relationship management, CRM tips        |
| **Product Support**   | `product-support.png`     | Help guides, troubleshooting, support articles    |
| **Grants**            | `grant.png`               | Grant opportunities, funding news, applications   |

## 📈 What Gets Published

### Blog Posts

- **Format**: Professional blog format (.mdx files)
- **Location**: Automatically organized by category
- **Content**: Original content from Voltade website
- **SEO**: Optimized for search engines

### Images

- **Size**: 800x480 pixels (optimized for web)
- **Quality**: High quality but compressed for fast loading
- **Branding**: Uses your uploaded category graphics
- **Text**: Blog post title prominently displayed
- **Brand**: "Voltade Blog" watermark

## 🕒 Schedule

- **Daily Check**: Every day at 9:00 AM Singapore Time
- **Processing Time**: Usually completes within 5-10 minutes
- **Publication**: Blog posts appear on your website immediately after processing

## 🚨 What To Watch For

### ✅ Good Signs

- Blog posts appearing on your website daily (if there's new content)
- Images loading properly with your branding
- Posts categorized correctly
- No duplicate content

### ⚠️ Warning Signs

- No new posts for several days (might mean no new content on source website)
- Images not appearing (could be a technical issue)
- Posts in wrong categories (may need category mapping adjustment)

## 🛠 For Technical Support

If something isn't working, here's what technical support needs to know:

### System Components

- **Cloudflare Workers**: Handles the automation
- **R2 Storage**: Stores your category graphics
- **GitHub Integration**: Publishes to your blog
- **Browser API**: Creates the images

### Key Settings

- **Size Limit**: Images kept under 150KB for fast loading
- **Image Quality**: 40% compression for optimal balance
- **Viewport**: 800x480 pixels for consistent sizing
- **Title Position**: 55% from top, 50% width for readability

### Files Location

- Graphics stored in: `blog-graphics` bucket
- Blog posts published to: `docs/pages/[category]/[post-name].mdx`
- Images saved to: `docs/public/images/blog/[category]/[image-name].jpg`

## 📋 Maintenance Checklist (Monthly)

### For Sales Managers

- [ ] Check that new blog posts are appearing regularly
- [ ] Verify images look good and load quickly
- [ ] Confirm posts are in the right categories
- [ ] Review overall blog performance and engagement

### For Technical Team

- [ ] Check system logs for any errors
- [ ] Verify all category graphics are still accessible
- [ ] Confirm GitHub integration is working
- [ ] Monitor image file sizes and quality

## 🆘 Common Issues & Solutions

### "No new blog posts appearing"

- **Check**: Is there actually new content on the source website?
- **Solution**: Usually means no new content to process (this is normal)

### "Images not loading"

- **Check**: Are the category graphics still in the R2 storage?
- **Solution**: Re-upload graphics or contact technical support

### "Posts in wrong category"

- **Check**: Review the content - the AI categorizes based on content
- **Solution**: May need to adjust category mapping if consistently wrong

### "System not running"

- **Check**: Look for daily activity around 9 AM Singapore time
- **Solution**: Contact technical support to check Cloudflare Workers status

## 📞 Support Contacts

For issues with this system:

1. **First**: Check this README for common solutions
2. **Technical Issues**: Contact your development team
3. **Content Issues**: Review source website content
4. **Emergency**: System completely down for more than 24 hours

## 📈 Success Metrics

Track these to measure success:

- **Daily Posts**: New content published when available
- **Image Quality**: Professional, branded images loading properly
- **Categorization**: Posts sorted into correct categories
- **Performance**: Fast loading times and good user experience
- **Automation**: System running without manual intervention

---

_Last Updated: August 2025_  
_System Version: Production-Ready with optimized image generation_
