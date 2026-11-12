import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 보통은 `npm run build`로 배포용 파일을 만든다.
// `npm run build:single`은 파일 하나짜리 미리보기를 만든다.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  publicDir: mode === 'single' ? false : 'public', // 미리보기 한 파일에는 자세 판정 파일(18MB)을 넣지 않는다
  build: mode === 'single' ? { outDir: 'dist-single', assetsInlineLimit: 100000000 } : {},
}));
