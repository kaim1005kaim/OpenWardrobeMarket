"""
CLIP Embedding Server

Provides a REST API for generating CLIP embeddings from images.
Uses Hugging Face transformers with PyTorch.

Endpoints:
  POST /embed - Generate embedding from uploaded image
  GET /health - Health check
  GET /models - List available models

Usage:
  python server.py [--model MODEL_NAME] [--port PORT] [--device cpu|cuda]
"""

from transformers import CLIPProcessor, CLIPModel
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import torch
import io
import argparse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Available CLIP models
MODELS = {
    'vit-b-32': 'openai/clip-vit-base-patch32',      # 512 dimensions
    'vit-b-16': 'openai/clip-vit-base-patch16',      # 512 dimensions
    'vit-l-14': 'openai/clip-vit-large-patch14',     # 768 dimensions
    'vit-l-14-336': 'openai/clip-vit-large-patch14-336',  # 768 dimensions, higher resolution
}

# Global variables for model and processor
model = None
processor = None
device = None
model_name = None


def load_model(model_key='vit-b-32', device_name='cpu'):
    """Load CLIP model and processor"""
    global model, processor, device, model_name

    if model_key not in MODELS:
        raise ValueError(f"Unknown model: {model_key}. Available: {list(MODELS.keys())}")

    model_id = MODELS[model_key]
    model_name = model_key

    logger.info(f"Loading model: {model_id}")
    logger.info(f"Device: {device_name}")

    device = torch.device(device_name)

    # Load model and processor
    model = CLIPModel.from_pretrained(model_id).to(device)
    processor = CLIPProcessor.from_pretrained(model_id)

    # Set to evaluation mode (disable dropout, etc.)
    model.eval()

    logger.info(f"Model loaded successfully!")
    logger.info(f"Embedding dimension: {model.config.projection_dim}")


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'model': model_name,
        'device': str(device),
        'dimension': model.config.projection_dim if model else None,
    })


@app.route('/models', methods=['GET'])
def list_models():
    """List available models"""
    return jsonify({
        'current': model_name,
        'available': list(MODELS.keys()),
        'models': {
            'vit-b-32': {'dim': 512, 'quality': 'good', 'speed': 'fast'},
            'vit-b-16': {'dim': 512, 'quality': 'better', 'speed': 'medium'},
            'vit-l-14': {'dim': 768, 'quality': 'best', 'speed': 'slow'},
            'vit-l-14-336': {'dim': 768, 'quality': 'best+', 'speed': 'slowest'},
        }
    })


@app.route('/embed', methods=['POST'])
def embed_image():
    """Generate CLIP embedding from uploaded image"""
    try:
        # Check if image file is provided
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400

        # Read image
        image_file = request.files['image']
        image_bytes = image_file.read()

        # Open image with PIL
        try:
            image = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            return jsonify({'error': f'Invalid image file: {str(e)}'}), 400

        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Process image
        inputs = processor(images=image, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}

        # Generate embedding
        with torch.no_grad():
            image_features = model.get_image_features(**inputs)

            # Normalize to unit vector (for cosine similarity)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)

        # Convert to list
        embedding = image_features[0].cpu().tolist()

        return jsonify({
            'embedding': embedding,
            'dimension': len(embedding),
            'model': model_name,
        })

    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/embed/batch', methods=['POST'])
def embed_batch():
    """Generate embeddings for multiple images at once"""
    try:
        files = request.files.getlist('images')

        if not files:
            return jsonify({'error': 'No images provided'}), 400

        embeddings = []

        for file in files:
            image_bytes = file.read()
            image = Image.open(io.BytesIO(image_bytes))

            if image.mode != 'RGB':
                image = image.convert('RGB')

            inputs = processor(images=image, return_tensors="pt")
            inputs = {k: v.to(device) for k, v in inputs.items()}

            with torch.no_grad():
                image_features = model.get_image_features(**inputs)
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)

            embedding = image_features[0].cpu().tolist()
            embeddings.append(embedding)

        return jsonify({
            'embeddings': embeddings,
            'count': len(embeddings),
            'dimension': len(embeddings[0]) if embeddings else 0,
            'model': model_name,
        })

    except Exception as e:
        logger.error(f"Error in batch embedding: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='CLIP Embedding Server')
    parser.add_argument('--model', type=str, default='vit-b-32',
                        choices=list(MODELS.keys()),
                        help='CLIP model to use')
    parser.add_argument('--port', type=int, default=5000,
                        help='Port to run server on')
    parser.add_argument('--device', type=str, default='cpu',
                        choices=['cpu', 'cuda', 'mps'],
                        help='Device to run model on (cpu, cuda for NVIDIA GPU, mps for Apple Silicon)')
    parser.add_argument('--host', type=str, default='0.0.0.0',
                        help='Host to bind to')

    args = parser.parse_args()

    # Auto-detect device if CUDA is available
    if args.device == 'cpu' and torch.cuda.is_available():
        logger.info("CUDA available, switching to GPU")
        args.device = 'cuda'
    elif args.device == 'cpu' and torch.backends.mps.is_available():
        logger.info("Apple Silicon detected, switching to MPS")
        args.device = 'mps'

    # Load model
    load_model(args.model, args.device)

    # Start server
    logger.info(f"Starting server on {args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=False)
