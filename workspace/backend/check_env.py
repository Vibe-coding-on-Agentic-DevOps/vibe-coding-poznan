#!/usr/bin/env python3
"""
Environment Variables Checker for Azure OpenAI
"""
import os
from dotenv import load_dotenv

# Load .env file if it exists
if os.path.exists('.env'):
    load_dotenv('.env')
    print("✓ .env file found and loaded")
else:
    print("⚠ No .env file found")

# Check required environment variables
required_vars = [
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_KEY',
    'AZURE_GPT_KEY',
    'AZURE_GPT_ENDPOINT',
    'AZURE_OPENAI_DEPLOYMENT'
]

print("\n=== Environment Variables Check ===")
for var in required_vars:
    value = os.environ.get(var)
    if value:
        # Only show first 10 characters for security
        masked_value = value[:10] + "..." if len(value) > 10 else value
        print(f"✓ {var}: {masked_value}")
    else:
        print(f"✗ {var}: NOT SET")

print("\n=== Azure OpenAI Configuration ===")
endpoint = os.environ.get('AZURE_OPENAI_ENDPOINT')
key = os.environ.get('AZURE_OPENAI_KEY')

if endpoint and key:
    print("✓ Azure OpenAI appears to be configured")
    print(f"  Endpoint: {endpoint}")
    print(f"  Key: {'SET' if key else 'NOT SET'}")
else:
    print("✗ Azure OpenAI configuration incomplete")
    print("  Required variables: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY")
    print("\n  To fix this in Azure:")
    print("  1. Go to your Azure Web App")
    print("  2. Navigate to Configuration > Application Settings")
    print("  3. Add these environment variables:")
    print("     - AZURE_OPENAI_ENDPOINT: Your Azure OpenAI endpoint URL")
    print("     - AZURE_OPENAI_KEY: Your Azure OpenAI API key")
    print("     - AZURE_GPT_KEY: Your Azure GPT API key")
    print("     - AZURE_GPT_ENDPOINT: Your Azure GPT endpoint URL")
