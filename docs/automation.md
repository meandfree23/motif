# MOTIF 일간 운영

2026-10-19부터 예약 ID `motif`는 이 대화 `01a08a46-048e-70b0-bd48-7a1bf35b3c94`를 재사용하는 heartbeat이다. 매번 새 작업을 만드는 cron으로 되돌리지 않는다. 기존 시간(서울 00:30, 08:30, 13:30, 19:30, 23:30)은 유지한다. 이 대화를 자동 보관하지 않는다.

## 운영 원본

- 라이브: https://meandfree23.github.io/motif/
- 원본: GitHub `meandfree23/motif`, `main`.
- 편집 원장: `data.json`, `curator_memory.json`, `sources.json`, `signals.json`, `toolkit.json`.
- 품질 검사: 원본 저장소 `scripts/check-dedup.mjs`.
- 이전 `/Users/kk/Documents/검색`의 ChatGPT Sites/D1 발행 경로는 현재 운영 원본이 아니다. `project_not_found` 호출을 반복하지 않는다.
- GitHub 앱 연결에서 저장소 읽기 및 push 권한을 확인했다. CLI `gh`와 별도 `mcp__github` 연결은 인증이 만료되어 있으므로 연결된 `mcp__codex_apps__github` 도구를 사용한다. 토큰을 파일이나 명령에 넣지 않는다.

## 각 회차

1. 서울 날짜와 현재 원본의 최신 SHA를 얻는다. 오늘 호가 이미 발행되었다면 재생성하지 않고 라이브 반영 여부만 검사한다. 이 대화의 마지막 날짜나 예전 실행 기록은 발행 원장으로 사용하지 않는다.
2. 오늘 호가 없으면 현재 curator memory의 mission, editorial_rules, dedup_policy, taste_profile과 최신 이슈를 읽고 같은 데이터 구조로 조사한다. 과거 날짜는 사용자가 범위를 요청한 경우에만 별도 복구한다. 과거 원고를 오늘 날짜로 복제하지 않는다.
3. Latest는 검증된 서로 다른 작품 6–8개, Focus 1개를 작성한다. 같은 도메인 최대 2개, 최소 3개 권역을 충족한다. 기존 insight/tags/origin, crosscurrent, Focus 필드와 의미를 보존한다. 모르는 출신지·제작 연도·사실은 만들어내지 않는다. Focus는 현재 사이트 구조대로 당일 작품 중 한 개를 깊게 다루되 과거 Focus와 중복하지 않는다.
4. 공식 작가/기관/작품 페이지의 1차 근거를 확인한다. 제목, 실제 작품 사진, 크레딧, 출처 URL과 사용/프리뷰 근거를 확인한다. Focus는 2개 이상 출처와 4개 이상 분석 단락을 갖춘다. 작품 사진이 없는 후보는 다른 검증된 후보로 교체한다. 기존 이미지 self-hosting 규칙을 따른다.
5. 후보에 `node scripts/check-dedup.mjs data.json --candidates candidates.json --memory curator_memory.json --json`을 실행한다. 새 이슈를 합친 후 `node scripts/check-dedup.mjs data.json --new YYYY-MM-DD --memory curator_memory.json --json`을 실행하고 FAIL 0인지 확인한다. 별도로 최소 개수, Focus 완결성, 이미지 실제 로딩을 검사한다. 검사 실패 시 발행하지 않는다.
6. 커밋 직전에 `data.json`을 다시 읽어 다른 Claude/사용자 발행이 있었는지 확인한다. 이미 오늘 호가 있으면 중복 삽입하지 않는다. SHA가 달라졌으면 최신 원본에 한 번 병합하고 다시 검사한다. 연결된 GitHub 앱의 update_file(현재 blob SHA 필수) 또는 원자적 tree/commit/update_ref(expected_sha 필수)로 반영한다. force push 금지. 기존 이슈와 컬렉션을 보존한다.
7. GitHub Pages 반영을 확인한다. 캐시 없는 라이브 `data.json` 요청에서 오늘 호의 날짜·제목·항목 ID·Focus를 원본과 대조하고 모든 새 이미지 HTTP 성공을 확인한 후에만 published로 기록한다. 커밋 성공만으로 발행 완료라고 쓰지 않는다. 한 회차의 검증 대기는 총 3분 이내이며 다음 회차가 미완료 검증을 이어간다.
8. 상태 파일 `docs/motif-automation-status.json`은 최신 상태만 덮어쓴다. 정상/변화 없음에서는 장문의 실행 보고를 남기지 않는다. 같은 오류를 반복 알리지 않는다. 사용자 조치가 필요한 새로운 오류와 오류 해소만 이 대화에 짧게 알린다. 새로운 독립 작업을 생성하거나 고정하지 않는다.

## 중복·정체 처리

- 동시에 같은 날짜를 처리하지 않는다. 이 대화의 단일 예약을 사용하며, 타 발행자와의 충돌은 원본 재조회 및 SHA 조건으로 감지한다.
- 인증 오류·정책 거절·권리 문제를 만나면 우회하지 않는다. 검증된 초안을 로컬에 보존하고 상태에 원인과 필요한 조치를 한 번 기록한다.
- 동일 실패를 하루 여러 번 길게 재분석하지 않는다. 원인 상태가 바뀌었는지 짧게 확인하고, 새 근거가 있을 때만 재개한다.
- 일요일 Signals/Toolkit 갱신은 현재 curator memory의 축적 기준을 따른다. 근거가 부족하면 임의로 신호를 만들지 않는다.

## 2026-10-19 전환 점검

- 기존 cron → 동일 ID heartbeat로 전환하고 이 대화 연결을 확인했다.
- 종료된 MOTIF 자동 실행 작업 105개를 보관했다. 작업/콘텐츠 삭제는 없으며 보관함에서 복원할 수 있다.
- 라이브 최신 날짜: 2026-10-16. 오늘자 발행의 성공 여부는 상태 파일의 liveVerified 값으로 구분한다.
