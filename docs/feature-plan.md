# 기능 명세: 선수 응원 방명록 (팬 댓글)

> 이 문서는 기능 설계와 검사 방법을 기록합니다. 아직 **구현·push하지 않은** 계획 단계 문서입니다.
> 최초 작성일: 2026-11-02

## 1. 개요

SSG 랜더스 팬페이지(`index.html`) 방문자가 선수에게 짧은 응원 메시지를 남기고,
다른 방문자가 남긴 메시지를 함께 볼 수 있는 **익명 방명록** 기능.

- 대상 페이지: `index.html` (기존 정적 팬페이지 유지, 섹션 하나 추가)
- 저장소: Supabase (학생 필수 구성)
- 배포: Netlify (빌드 없는 정적 사이트 + 브라우저에서 Supabase 직접 호출에 적합)
- 인증 방식: **로그인 없음 / 익명 자유 입력** (닉네임 직접 입력)

### 선택 확정 내역

| 항목 | 선택 |
| --- | --- |
| 기능 | 선수 응원 방명록 |
| 배포 서비스 | Netlify |
| 데이터 저장소 | Supabase |
| 입력 방식 | 익명 자유 입력 (로그인 없음) |

---

## 2. 가장 작은 완성 버전 (MVP)

현재 정적 프로젝트를 **그대로 유지**하면서, `index.html` 하단에 방명록 섹션 하나만 추가한다.
흐름은 **입력 → 저장(Supabase insert) → 목록 조회(Supabase select)** 한 줄기로 끝낸다.

빌드 과정 없음. Supabase JS 클라이언트를 CDN `<script>`로 불러와 브라우저에서 직접 호출한다.

범위에 **포함**:
- 응원 메시지 작성(닉네임 + 메시지)
- 저장
- 최신순 목록 표시

범위에서 **제외**(이번 MVP 아님):
- 로그인/회원가입
- 메시지 수정·삭제
- 좋아요·답글
- 선수별 필터(초기엔 전체 목록 하나만)

---

## 3. 화면 구성 (입력란 · 버튼 · 결과)

`index.html` 하단에 `#guestbook` 섹션 추가.

### 입력란

| 요소 | id | 타입 | 제약 |
| --- | --- | --- | --- |
| 닉네임 | `gb-nickname` | text | 필수, 1~20자 |
| 응원 메시지 | `gb-message` | textarea | 필수, 1~200자 |
| (선택) 선수 이름 | `gb-player` | text | 선택, 0~20자 — MVP에선 자유 입력 메모 용도 |

### 버튼

| 요소 | id | 동작 |
| --- | --- | --- |
| 등록 버튼 | `gb-submit` | 입력 검증 후 Supabase에 insert, 성공 시 목록 새로고침 |

### 결과 표시 영역

| 요소 | id | 내용 |
| --- | --- | --- |
| 상태 메시지 | `gb-status` | 성공/실패 안내 문구 표시 |
| 목록 영역 | `gb-list` | 저장된 응원 메시지를 최신순으로 렌더링 |

목록 항목 한 개 표시 형식: `닉네임 · (선수 이름 있으면 표시) · 메시지 · 작성시각`

---

## 4. 저장할 항목 (데이터 모델)

### Supabase 테이블: `guestbook`

| 컬럼 | 타입 | 설명 | 비고 |
| --- | --- | --- | --- |
| `id` | `uuid` | 기본 키 | `default gen_random_uuid()` |
| `nickname` | `text` | 작성자 닉네임 | NOT NULL, 1~20자 |
| `message` | `text` | 응원 메시지 | NOT NULL, 1~200자 |
| `player` | `text` | 대상 선수 이름(선택) | NULL 허용 |
| `created_at` | `timestamptz` | 작성 시각 | `default now()` |

> 익명 입력이므로 작성자 식별 컬럼(user_id 등)은 두지 않는다.

### 테이블 생성 SQL (예시, 아직 실행하지 않음)

```sql
create table if not exists public.guestbook (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 20),
  message  text not null check (char_length(message) between 1 and 200),
  player   text check (player is null or char_length(player) <= 20),
  created_at timestamptz not null default now()
);
```

---

## 5. 저장·조회 설계 (Supabase)

브라우저에서 Supabase JS 클라이언트(anon 공개 키)로 직접 호출한다.

### 조회 (페이지 로드 시, 등록 성공 후)

```js
const { data, error } = await supabase
  .from('guestbook')
  .select('nickname, message, player, created_at')
  .order('created_at', { ascending: false })
  .limit(50);
```

### 저장 (등록 버튼 클릭 시)

```js
const { error } = await supabase
  .from('guestbook')
  .insert({ nickname, message, player: player || null });
```

> anon 키는 공개되어도 되는 공개 키다. 민감한 서비스 키(service_role)는 **절대 클라이언트에 넣지 않는다.**

---

## 6. 성공 · 실패 동작

### 등록 성공
- `gb-status`에 "응원이 등록되었습니다 ⚾" 표시
- 입력란(닉네임·메시지·선수) 초기화
- 목록(`gb-list`) 다시 조회해 새 메시지가 맨 위에 보이게 함

### 등록 실패 — 입력 검증 실패 (네트워크 전송 전)
- 빈 닉네임/메시지, 길이 초과 → `gb-status`에 어떤 항목이 문제인지 안내
- Supabase 호출하지 않음, 입력값 유지

### 등록 실패 — Supabase 오류 (네트워크/권한/서버)
- `gb-status`에 "등록에 실패했습니다. 잠시 후 다시 시도해 주세요." 표시
- 입력값 유지(사용자가 다시 시도 가능)
- 콘솔에 `error` 상세 기록

### 목록 조회 실패
- `gb-list`에 "응원 목록을 불러오지 못했습니다." 표시
- 입력·등록 기능은 계속 사용 가능

---

## 7. 접근 제한 (익명 자유 입력이므로 필요)

로그인 없는 자유 입력이라 악용 방지가 필수다.

### Supabase RLS (Row Level Security)
- 테이블에 RLS **활성화**
- `anon` 역할에 **select** 허용 (모두 읽기 가능)
- `anon` 역할에 **insert** 허용 (모두 작성 가능)
- **update / delete 는 정책을 만들지 않아 차단** (anon이 기존 글 수정·삭제 불가)

```sql
alter table public.guestbook enable row level security;

create policy "anyone can read guestbook"
  on public.guestbook for select
  to anon using (true);

create policy "anyone can insert guestbook"
  on public.guestbook for insert
  to anon with check (
    char_length(nickname) between 1 and 20
    and char_length(message) between 1 and 200
    and (player is null or char_length(player) <= 20)
  );
```

### 클라이언트 측 보호
- 입력 길이 제한 + 빈 값 차단(저장 전 검증)
- 등록 버튼 연타 방지(전송 중 버튼 비활성화)
- 간단한 비속어/스팸 필터(선택, MVP 이후 확장 가능)
- 사용자 입력은 텍스트로만 렌더링(`textContent`)해 **XSS 방지** (HTML 삽입 금지)

### 키 관리
- 클라이언트에는 **anon 공개 키만** 사용
- `service_role` 키는 클라이언트·저장소에 절대 포함하지 않음

---

## 8. 검사 방법 (어떻게 성공을 확인하는가)

> 모든 검사는 "직접 확인"을 원칙으로 한다. 명령이 오류 없이 끝난 것만으로 성공으로 보지 않는다.

### A. 로컬 기능 검사 (브라우저)
1. 로컬에서 `index.html`을 연다(또는 간단한 로컬 서버로 서빙).
2. 방명록 섹션이 보이는지 확인.
3. 정상 입력(닉네임+메시지) 후 등록 → `gb-status`에 성공 문구, 목록 맨 위에 새 글이 보이는지 확인.
4. 빈 닉네임/빈 메시지/길이 초과로 등록 → 검증 실패 안내가 뜨고 Supabase 호출이 일어나지 않는지 확인.
5. 페이지 새로고침 후에도 등록한 글이 목록에 남아 있는지 확인(= Supabase에 실제 저장됨).

### B. Supabase 저장 검사 (데이터 직접 확인)
1. Supabase 대시보드 Table Editor에서 `guestbook` 행이 실제로 생겼는지 확인.
2. `created_at`, `nickname`, `message`, `player` 값이 입력한 대로 들어갔는지 확인.

### C. 접근 제한(RLS) 검사
1. 브라우저 콘솔에서 anon 키로 `update`/`delete` 시도 → 거부되는지 확인.
2. anon 키로 `select`/`insert`는 정상 동작하는지 확인.
3. 길이 제약 위반 insert가 거부되는지 확인(DB check + RLS with check).

### D. 실패 동작 검사
1. 네트워크를 끊거나 잘못된 Supabase URL로 설정해 등록 → 실패 문구가 뜨고 입력값이 유지되는지 확인.
2. 목록 조회가 실패하는 상황에서 안내 문구가 뜨는지 확인.

### E. 배포 검사 (Netlify)
1. Netlify에 정적 폴더 배포 후 공개 URL 접속.
2. 위 A 검사를 배포 환경에서 반복(등록·조회·새로고침 유지).
3. HTTPS로 서빙되는지, Supabase 호출이 브라우저에서 정상 동작하는지 확인.

---

## 9. 남은 결정 / 메모

- Supabase 프로젝트 URL·anon 키는 실제 구현 단계에서 발급받아 적용한다(현재 미보유 가정).
- 선수별 필터·정렬은 MVP 이후 확장 항목으로 남긴다.
- 이 문서는 계획이며, 구현과 배포(push)는 사용자의 추가 지시가 있을 때 진행한다.

---

## 10. 배포 기록 (2026-11-02)

- 배포 서비스: Netlify
- Netlify 사이트(프로젝트) 이름: `ashley-kr1`
- 공개 배포 주소: https://ashley-kr1.netlify.app
- 연결 저장소: github.com/Ashley-kr1/Ashley-kr1.github.io (브랜치 `main`)
- 빌드 설정: Build command `bash ./build.sh`, Publish directory `publish`, Functions directory `netlify/functions`
- 첫 배포 결과: `pwsh` 빌드 명령으로 1차 실패(exit code 2) → `netlify.toml`을 `bash ./build.sh`로 수정·push 후 재배포 성공.
- 사이트 공개 설정: 처음 Private(외부 401)였고 "Make public"으로 공개 전환. 공개 주소에서 홈페이지 정상 확인(구단 소개·우승 기록·선수 목록·추천·경기 표 노출).
- 참고: 기존 GitHub Pages 주소(https://ashley-kr1.github.io/)와 별개로 Netlify 주소가 공존. 서버 함수(방명록 등)는 앞으로 Netlify 주소에서 테스트한다. GitHub Pages에는 서버 함수가 자동 생성되지 않는다.
- 미해결(배포와 별개): 선수 사진 파일명 불일치로 일부 선수는 플레이스홀더로 표시됨.
