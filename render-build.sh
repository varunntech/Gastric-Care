#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Building React frontend..."
cd frontend
npm ci
npm run build
cd ..

echo "Installing Python dependencies..."
pip install -r requirements.txt
