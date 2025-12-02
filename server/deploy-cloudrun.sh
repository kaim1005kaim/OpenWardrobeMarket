#!/bin/bash

# CLIP Server Deployment to Google Cloud Run
# Usage: ./deploy-cloudrun.sh [project-id] [region]

set -e

# Configuration
PROJECT_ID="${1:-open-wardrobe-market}"
REGION="${2:-us-central1}"
SERVICE_NAME="clip-server"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying CLIP Server to Cloud Run"
echo "   Project: ${PROJECT_ID}"
echo "   Region: ${REGION}"
echo "   Service: ${SERVICE_NAME}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "❌ Not logged in to gcloud. Please run:"
    echo "   gcloud auth login"
    exit 1
fi

# Set project
echo "📋 Setting project..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    containerregistry.googleapis.com

# Build and push Docker image
echo "🐳 Building Docker image..."
gcloud builds submit \
    --tag ${IMAGE_NAME} \
    --dockerfile Dockerfile.cloudrun \
    .

# Deploy to Cloud Run
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --memory 4Gi \
    --cpu 2 \
    --timeout 60 \
    --max-instances 10 \
    --min-instances 0 \
    --allow-unauthenticated \
    --port 8080

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --format 'value(status.url)')

echo ""
echo "✅ Deployment successful!"
echo ""
echo "📍 Service URL: ${SERVICE_URL}"
echo ""
echo "🧪 Test the service:"
echo "   curl ${SERVICE_URL}/health"
echo ""
echo "🔑 Next steps:"
echo "   1. Add CLIP_SERVER_URL to Vercel environment:"
echo "      vercel env add CLIP_SERVER_URL production"
echo "      Value: ${SERVICE_URL}"
echo ""
echo "   2. Update your code to use the new URL"
echo ""
echo "   3. Test embedding generation:"
echo "      curl -X POST ${SERVICE_URL}/embed -F image=@test-image.jpg"
echo ""
