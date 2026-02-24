# Read Anything - Netlify Deployment Guide

This application is ready to be deployed on Netlify.

## Deployment Steps

1.  **Connect to GitHub**: Push your code to a GitHub repository and connect it to Netlify.
2.  **Build Settings**:
    *   **Build Command**: `npm run build`
    *   **Publish Directory**: `dist`
3.  **Environment Variables**:
    Go to **Site settings > Environment variables** and add:
    *   `GEMINI_API_KEY`: Your Google Gemini API Key.
    *   `API_KEY`: (Optional) Your paid/preview Gemini API Key.

## SPA Routing
The included `netlify.toml` and `public/_redirects` files handle Single Page Application (SPA) routing, ensuring that all URLs are correctly handled by the app.
