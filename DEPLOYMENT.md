# Deployment Guide

## Prerequisites
1. Node.js 20 installed
2. Firebase CLI installed (`npm install -g firebase-tools`)
3. `firebase login` completed

## 1. Secrets Configuration (One-time setup)
Required for email notifications:
```bash
firebase functions:secrets:set EMAIL_USER
firebase functions:secrets:set EMAIL_PASS