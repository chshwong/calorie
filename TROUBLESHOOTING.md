# Troubleshooting Guide

## Common Issues and Solutions

### 1. Clear Cache and Reinstall Dependencies
```bash
cd "D:\Main Storage\Projects\Calorie\calorie-tracker"
rm -rf node_modules
rm -rf .expo
npm install
npx expo start --clear
```

### 2. Check Environment Variables
Make sure your `.env` file exists in `calorie-tracker/` directory with:
```
EXPO_PUBLIC_SUPABASE_URL=your-actual-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-actual-key
```

### 3. Port Already in Use
If port 8081 is in use:
```bash
npx expo start --port 8082
```

### 4. Missing Dependencies
```bash
npm install
```

### 5. TypeScript Errors
```bash
npx tsc --noEmit
```

### 6. Reset Metro Bundler
```bash
npx expo start --clear
```

