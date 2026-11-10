---
name: create-pr
description: |
  현재 브랜치의 커밋과 diff를 분석해 PR 제목·본문을 작성하고 `gh pr create`로 GitHub Pull Request를 생성한다.
  "PR 만들어줘", "PR 생성", "풀리퀘스트 올려줘", "create pr", "open a pull request", "/create-pr" 같은 요청에 활성화한다.
  본문은 references/pr-template.kr.md(한국어) 또는 references/pr-template.en.md(영어) 템플릿을 사용한다.
  커밋 작성(/commit)이나 리뷰 반영(/autofix)에는 쓰지 않는다.
context: fork
---

# create-pr: 브랜치 분석 → PR 생성

현재 브랜치의 변경사항을 읽고 템플릿에 맞춰 PR 본문을 작성한 뒤 PR을 생성한다. 격리된 컨텍스트(`context: fork`)에서 실행되므로, 끝나면 PR URL과 요약만 보고한다.

## 인자

- `kr` / `en`: 본문 언어. 생략하면 최근 커밋 메시지·README의 언어를 따르고, 판단이 안 되면 `kr`.
- `--base <브랜치>`: 대상 브랜치. 생략하면 저장소 기본 브랜치.
- `--draft`: 초안(Draft) PR로 생성.

## 절차

### 1. 사전 확인

```bash
git rev-parse --abbrev-ref HEAD
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
git status --short
gh auth status
```

- 현재 브랜치가 base 브랜치와 같으면 중단하고, 새 브랜치에서 작업하도록 알린다. 브랜치를 임의로 만들거나 옮기지 않는다.
- 커밋되지 않은 변경이 있으면 PR에 포함되지 않는다고 알린다. 커밋은 대신 하지 않는다.
- `gh` 미설치·미인증이면 그 사실을 알리고 종료한다.

### 2. 변경사항 분석

```bash
git fetch origin <base>
git log --oneline origin/<base>..HEAD
git diff origin/<base>...HEAD --stat
git diff origin/<base>...HEAD
```

- 커밋이 없으면 알리고 종료한다.
- 관련 이슈 번호가 커밋·브랜치명에 있으면 본문의 관련 이슈에 연결한다.
- `.env`, 키·토큰 등 비밀 정보가 diff에 보이면 PR을 만들지 않고 경고한다.

### 3. 제목·본문 작성

1. 언어에 맞는 `references/pr-template.kr.md` 또는 `references/pr-template.en.md` 하나만 Read로 읽는다.
2. 템플릿의 모든 섹션을 diff 근거로 채운다. 확인할 수 없는 항목(테스트 실행 여부 등)은 추측하지 말고 비워 두거나 "미확인"으로 적는다.
3. 제목은 커밋 컨벤션(`feat|fix|refactor|chore: 요약`)을 따르고 70자 이내로 쓴다. 커밋이 여러 종류면 가장 비중이 큰 type을 쓴다.
4. 해당하지 않는 섹션은 삭제하지 않고 "해당 없음"(en: "N/A")으로 둔다.

### 4. 생성

```bash
git push -u origin HEAD        # 원격에 브랜치가 없을 때만
gh pr create --base <base> --title "<제목>" --body-file <본문 파일> [--draft]
```

- 본문은 임시 파일에 써서 `--body-file`로 넘긴다. 줄바꿈과 특수문자가 깨지지 않게 한다.
- 이미 같은 브랜치의 열린 PR이 있으면(`gh pr view`) 새로 만들지 않고 URL만 알린다.
- 시스템 지시에 PR 본문 말미 attribution 문구가 있으면 본문 끝에 추가한다.

### 5. 보고

PR URL, 제목, base ← head 브랜치, 포함된 커밋 수를 간단히 보고한다.

## 하지 말 것

- `--force` push, 브랜치 삭제, 기본 브랜치 직접 push를 하지 않는다.
- 사용자 요청 없이 리뷰어 지정·머지·라벨 변경을 하지 않는다.
- diff에 없는 내용을 본문에 지어내지 않는다.
