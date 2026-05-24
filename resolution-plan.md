# Resolution Plan

## 목표
현재 `problems.md`에 정리된 이슈를 우선순위 기반으로 해결하여,
- 개발/검증 파이프라인 정상화
- UI 일관성 확보
- 확장 배포 호환성 개선
- 그래프 성능 안정화
를 달성한다.

## 범위
- 포함: lint, 스타일 체계, 빌드 스크립트, manifest 정합성, 그래프 탐색 성능
- 제외: 신규 기능 추가, 대규모 리디자인, 백엔드/외부 서비스 변경

## 우선순위
1. 린트 복구 (개발 생산성/품질 게이트)
2. 스타일 시스템 정리 (화면 깨짐 방지)
3. 빌드 스크립트 크로스플랫폼화 (배포 자동화 안정화)
4. Firefox MV3 manifest 정합성 수정 (확장 배포 리스크 제거)
5. 그래프 확장 로직 성능 개선 (대용량 데이터 대응)

## 작업 계획

### Phase 1. Lint 복구
- 작업
  - `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`를 devDependencies에 추가.
  - `npm run lint` 통과 확인.
- 완료 조건
  - 린트 명령이 오류 없이 종료.
- 리스크
  - 잠재 lint 오류가 추가로 노출될 수 있음.
- 대응
  - 신규 lint 오류는 규칙 완화보다 코드 수정 우선으로 처리.
  - 불가피한 예외는 파일 단위 최소 범위로만 허용.

### Phase 2. 스타일 시스템 단일화
- 의사결정 (둘 중 하나)
  - A안: Tailwind 도입 후 `App.jsx` 유틸리티 클래스 유지
  - B안: Tailwind 클래스 제거 후 CSS 기반으로 치환
- 선택 기준
  - 일정 우선(1~2일 내 안정화): B안
  - 장기 확장성/유틸리티 중심 개발: A안
  - 팀 내 Tailwind 경험 부족 또는 의존성 최소화 필요: B안
- 권장
  - 빠른 안정화 목적이면 B안(현재 구조 유지 + CSS 치환)이 변경 폭 관리에 유리.
- 완료 조건
  - 메인 레이아웃/검색바/그래프 컨테이너가 의도대로 렌더링.
  - 스타일이 특정 도구(Tailwind 미설치 등)에 의존하지 않음.
- 리스크
  - 스타일 치환 과정에서 레이아웃 회귀 발생 가능.
- 대응
  - 주요 화면 스냅샷(헤더/검색/그래프 영역) 기준 전후 비교.
  - 모바일 폭(최소 360px)에서 레이아웃 붕괴 여부 확인.

### Phase 3. 빌드 스크립트 크로스플랫폼화
- 작업
  - Windows 전용 `copy` 명령을 Node 기반 복사 스크립트 또는 `cpx`/`shx` 등으로 치환.
  - `build:chrome`, `build:firefox`를 Linux/macOS/Windows에서 동일하게 동작하도록 구성.
- 완료 조건
  - 주요 OS 환경에서 동일 명령으로 빌드 성공.
- 리스크
  - 스크립트 치환 후 CI/로컬 경로 처리 차이로 실패 가능.
- 대응
  - 상대경로 고정(`public` -> `dist`) 및 빌드 후 파일 존재 체크를 스크립트에 포함.

### Phase 4. Firefox manifest 정합성
- 작업
  - `public/manifest.firefox.json`의 MV3 부적합 항목 점검/삭제.
  - Firefox(최소 109+, 가능하면 최신 안정 버전)에서 `about:debugging` 임시 로드 테스트.
  - manifest 파싱 오류/권한 경고/백그라운드 관련 경고 로그 점검.
- 완료 조건
  - Firefox 확장 로드시 manifest 관련 오류 없음.
  - 새 탭 override 동작 확인.
- 리스크
  - 브라우저별 manifest 차이로 Chrome 동작 회귀 가능.
- 대응
  - Chrome/Firefox manifest를 분리 유지하고 공통 변경 최소화.

### Phase 5. 그래프 확장 성능 개선
- 작업
  - `BookmarkGraph.tsx`의 확장 로직에서 반복 `nodes.find(...)` 제거.
  - 초기 로드시 `id -> node` 인덱스(Map) 생성 후 조회 O(1)로 변경.
- 완료 조건
  - 기준 데이터셋 1,000 노드에서 폴더 expand/collapse 10회 평균 처리시간 100ms 이하(로컬 개발환경 기준).
  - 기준 데이터셋 3,000 노드에서 동일 동작 평균 200ms 이하.
  - 기존 상호작용(hover/click/zoom/label) 동작 회귀 없음.
- 리스크
  - 최적화 과정에서 표시 노드/링크 누락 가능.
- 대응
  - 변경 전후 노드/링크 개수 검증 로그를 임시로 추가해 비교 후 제거.

## 검증 계획
- 필수
  - `npm run build` 성공
  - `npm run lint` 성공
  - 검색 입력/엔터 동작 확인
  - 그래프 폴더 expand/collapse 동작 확인
  - 북마크 클릭 시 이동 동작 확인
- 확장 검증
  - Chrome/Firefox 각각에서 새 탭 override 정상 동작
  - manifest 관련 경고/오류 로그 없음

## 산출물
- 코드 수정 커밋(phase 단위 권장)
- 업데이트된 `problems.md` (해결 항목 체크 반영)
- 필요 시 `README.md` 실행/빌드 절차 보강

## 제안 일정 (단기)
- Day 1: Phase 1~2
- Day 2: Phase 3~4
- Day 3: Phase 5 + 회귀 테스트

## 게이트 기준
- Gate 1 (품질): `build`/`lint` 모두 통과
- Gate 2 (기능): 검색/그래프 상호작용/새 탭 override 정상
- Gate 3 (성능): Phase 5 정량 기준 충족
