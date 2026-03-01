# EcliPay Logo Upload Feature Implementation - Input

## Task Overview
Replace the logo URL text input in Settings with a proper image upload. Users should be able to upload a logo image file.

## Requirements

### Backend Changes
1. Install multer types dependency
2. Create upload endpoint in projects controller
3. Add updateLogo and removeLogo methods to projects service
4. Configure static file serving
5. Create uploads directory structure
6. Update Docker configuration for volume persistence

### Frontend Changes
1. Replace logo URL input with file upload component
2. Implement drag-and-drop functionality
3. Add upload progress and validation
4. Add logo preview and remove functionality
5. Update API proxy configuration

### Technical Requirements
- Support JPG, JPEG, PNG, GIF, WebP, SVG formats
- 2MB file size limit
- Drag & drop interface
- File validation (client and server-side)
- Automatic cleanup of old logo files
- Docker volume persistence for uploads
- API proxy for uploads path

## Files to Modify
- Backend: `src/projects/projects.controller.ts`, `src/projects/projects.service.ts`, `src/main.ts`, `docker-compose.yml`, `Dockerfile`, `package.json`
- Frontend: `frontend/src/components/SettingsPage.tsx`, `frontend/next.config.js`