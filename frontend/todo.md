# Enterprise File Sharing Platform - Development Plan

## Design Guidelines

### Design References
- **Dropbox.com**: Clean, professional file management UI
- **Google Drive**: Intuitive folder/file navigation
- **Style**: Modern Enterprise + Clean + Professional

### Color Palette
- Primary: #1E40AF (Deep Blue - brand)
- Secondary: #F8FAFC (Light Gray - background)
- Accent: #3B82F6 (Blue - interactive elements)
- Danger: #EF4444 (Red - delete/warning)
- Success: #22C55E (Green - success states)
- Surface: #FFFFFF (White - cards)
- Text Primary: #0F172A (Dark - headings)
- Text Secondary: #64748B (Gray - body)
- Border: #E2E8F0 (Light border)

### Typography
- Headings: Inter, font-weight 600-700
- Body: Inter, font-weight 400
- Monospace: JetBrains Mono (file sizes, metadata)

### Key Component Styles
- **Sidebar**: Fixed left sidebar with folder tree, dark blue header
- **File Grid/List**: Toggle between grid and list view
- **Cards**: White bg, subtle shadow, rounded-lg
- **Buttons**: Blue primary, ghost secondary, rounded-md

### Images to Generate
1. **logo-file-share.png** - Modern enterprise file sharing logo, shield with cloud and document icon, blue gradient (Style: minimalist, flat design)
2. **hero-cloud-storage.jpg** - Abstract cloud storage visualization, floating documents and folders in blue space (Style: 3d, modern)
3. **empty-folder.png** - Friendly empty state illustration, open folder with sparkles (Style: minimalist illustration)
4. **auth-background.jpg** - Professional enterprise background, abstract geometric blue pattern (Style: photorealistic, corporate)

---

## Database Architecture

### Tables (with session_id prefix: app_33d3cacbc5_)
1. **app_33d3cacbc5_profiles** - User profiles extending auth.users
2. **app_33d3cacbc5_folders** - Nested folder system with parent-child
3. **app_33d3cacbc5_files** - File metadata with storage path
4. **app_33d3cacbc5_sharing** - File/folder sharing permissions
5. **app_33d3cacbc5_audit_logs** - Activity tracking

### RLS Policies
- Super admin bypass for all tables
- Owner full CRUD access
- Shared users: view/edit based on permission level
- Storage bucket policies for private_files

---

## Development Tasks

### Phase 1: Database & Backend
1. Create all database tables with proper indexes, constraints, triggers
2. Set up RLS policies for all tables
3. Create storage bucket with policies

### Phase 2: Frontend Core (8 files max)
1. **src/lib/supabase.ts** - Supabase client initialization
2. **src/lib/types.ts** - TypeScript interfaces for all entities
3. **src/pages/Auth.tsx** - Login/Register page
4. **src/pages/Dashboard.tsx** - Main file manager (folder tree + file grid/list)
5. **src/pages/SharedWithMe.tsx** - Files/folders shared with current user
6. **src/pages/Admin.tsx** - Super admin panel (users, audit logs)
7. **src/components/FileManager.tsx** - Core file/folder management component (upload, create folder, rename, delete, share dialog, preview)
8. **src/App.tsx** - Router with auth guard

### Phase 3: Build & Test
- Install dependencies, lint, build
- CheckUI validation