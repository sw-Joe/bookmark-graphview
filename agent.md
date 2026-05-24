# Agent Guide: bookmark-graphview

## 1. Project Identity
- 목적: 브라우저 새 탭(Start Page)에서 북마크를 그래프로 시각화하는 확장형 웹앱.
- 핵심 UX: 검색창 + 북마크 포스 그래프(폴더 확장/축소, 노드 클릭 이동).
- 런타임:
  - 확장 환경: `chrome.bookmarks` API 사용.
  - 일반 웹 환경: `localStorage` 기반 mock bookmark tree 사용.

## 2. Tech Stack
- Frontend: React 19 + Vite 7
- Graph: `force-graph` (Canvas), `d3-force`
- Types: TypeScript 설정 존재, 실제 코드 일부는 JS/JSX 혼용
- Build Output: `dist/` (브라우저 확장 manifest 포함)

## 3. Important Paths
- 앱 엔트리: `src/main.jsx`
- 메인 레이아웃: `src/App.jsx`
- 그래프 렌더링: `src/components/BookmarkGraph.tsx`
- 검색 UI: `src/components/Search.tsx`, `src/components/Search.css`
- 북마크 서비스: `src/utils/bookmarkService.ts`
- 타입 정의: `src/types.ts`
- 확장 매니페스트:
  - Chrome: `public/manifest.json`
  - Firefox: `public/manifest.firefox.json`
- 문제 목록: `problems.md`

## 4. Commands
- 개발 서버: `npm run dev`
- 프로덕션 빌드: `npm run build`
- 린트: `npm run lint`

## 5. Current Known Issues (from problems.md)
1. Lint 실패: eslint plugin 의존성 누락 (`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`).
2. 스타일 불일치: Tailwind 클래스 사용 중이나 Tailwind 설정/의존성 부재.
3. OS 종속 빌드 스크립트: `copy` 명령(Windows 전용).
4. Firefox MV3 manifest 설정 점검 필요 (`background.scripts`).
5. 그래프 확장 시 `nodes.find(...)` 반복으로 성능 저하 가능.
6. 워크트리 변경 관찰: `src/assets/react.svg` 삭제 상태 확인 필요.

## 6. Working Rules for Agents
- 변경 전 `problems.md`와 관련 파일을 먼저 확인한다.
- 성능 이슈 수정 시 그래프 동작(확장/축소, hover, click, 줌)이 유지되는지 확인한다.
- UI 수정 시 스타일 전략을 먼저 고정한다.
  - 선택지 A: Tailwind 도입 및 클래스 유지
  - 선택지 B: 순수 CSS로 이전
  - 둘을 혼합한 임시 상태는 피한다.
- 확장 배포 관련 변경 시 Chrome/Firefox manifest를 각각 검증한다.
- 스크립트는 크로스플랫폼 기준으로 유지한다.

## 7. Recommended Next Fix Order
1. Lint 의존성 복구 및 `npm run lint` 통과.
2. 스타일 시스템 정리(Tailwind 도입 또는 클래스 제거).
3. 빌드 스크립트 크로스플랫폼화.
4. Firefox manifest MV3 정합성 수정.
5. `BookmarkGraph`의 노드 조회 맵 인덱싱으로 성능 개선.

## 8. Quick Validation Checklist
- `npm run build` 성공
- `npm run lint` 성공
- 새 탭 화면에서 검색 입력/엔터 동작
- 그래프 노드 hover/click/zoom 동작
- 폴더 expand/collapse 동작
- 확장 로드 시 manifest 오류 없음
