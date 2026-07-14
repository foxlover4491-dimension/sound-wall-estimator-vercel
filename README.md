# Sound Wall Estimator

방음 벽체, 천장, 바닥의 레이어 구성과 자재 물량을 산출하는 단일 HTML 앱입니다.

## Production

- URL: https://sound-wall-estimator-vercel.vercel.app
- Vercel project: `sound-wall-estimator-vercel`
- Vercel project ID: `prj_ZyKh4nZbEmw6cIyM1iuF1yaJe1IQ`

## Files

- `index.html`: 앱 전체 소스입니다.
- `.vercel/project.json`: 현재 이 Mac의 Vercel CLI 연결 정보입니다. 보통 GitHub에는 올리지 않습니다.

## Local Preview

```bash
python3 -m http.server 8787
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:8787
```

## Deploy

```bash
pnpm dlx vercel --prod --yes
```

다른 PC에서 처음 배포할 때 Vercel 연결을 다시 묻는다면 아래 프로젝트에 연결합니다.

```text
sound-wall-estimator-vercel
```

## Notes For Codex

- 앱은 현재 단일 파일 구조입니다. 수정은 주로 `index.html`에서 합니다.
- 자재관리의 브라우저 저장값은 `localStorage`에 저장됩니다. 다른 PC와 설정을 공유하려면 추후 `설정 내보내기 / 가져오기` 기능을 추가하는 것이 좋습니다.
- 다른 PC에서 Codex로 이어 작업하려면 이 폴더를 GitHub 저장소에 올리고, Vercel을 그 저장소와 연결하는 방식이 가장 안정적입니다.
