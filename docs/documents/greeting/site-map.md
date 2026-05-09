---
layout: default
title: "문서 구조와 링크"
parent: "문서 안내"
nav_order: 1
has_toc: true
permalink: /documents/greeting/site-map/
---

# 문서 구조와 링크

이 문서는 `docs` 디렉토리가 GitHub Pages 화면으로 어떻게 렌더링되고, 각 페이지가 어떤 링크로 이어지는지 설명합니다.

## 디렉토리 구조

```text
docs/
├── _config.yml
├── index.md
├── assets/
│   └── images/
│       ├── architecture-overview.png
│       └── architecture-detail.png
└── documents/
    ├── greeting.md
    ├── greeting/
    │   └── site-map.md
    ├── service.md
    ├── service/
    │   ├── user-flow.md
    │   └── features.md
    ├── development.md
    └── development/
        ├── architecture.md
        ├── setup.md
        └── tech-stack.md
```

## 화면 내비게이션 구조

`docs/_config.yml`에서 `documents` 컬렉션을 활성화합니다. `docs/documents` 아래 Markdown 파일은 각 파일의 front matter를 기준으로 사이드바에 표시됩니다.

```yaml
collections:
  documents:
    output: true
    permalink: "/:collection/:path/"
```

현재 사이드바 구조는 다음과 같습니다.

```text
이음                         /
문서 안내                    /documents/greeting/
└─ 문서 구조와 링크           /documents/greeting/site-map/
서비스 가이드                /documents/service/
├─ 사용자 흐름                /documents/service/user-flow/
└─ 주요 기능                  /documents/service/features/
개발 가이드                  /documents/development/
├─ 시스템 구조                /documents/development/architecture/
├─ 개발 환경 설정             /documents/development/setup/
└─ 기술 스택                  /documents/development/tech-stack/
```

## 시각화 컴포넌트

별도 React 컴포넌트는 없고, Markdown과 HTML이 Jekyll/Just the Docs 레이아웃으로 렌더링됩니다.

메인 페이지 `index.md`에서 사용하는 시각 요소는 다음과 같습니다.

- 히어로 영역: `.eeum-hero`
- 요약 링크 패널: `.eeum-summary`
- 카드 그리드: `.eeum-grid`, `.eeum-card`
- 기술 스택 배지: `.eeum-stack`
- 아키텍처 이미지 블록: `.eeum-figure`
- 자동 목차: `{:toc}`

이미지 자산은 `assets/images` 아래에서 관리합니다.

```text
assets/images/architecture-overview.png
assets/images/architecture-detail.png
```

## 본문 링크 흐름

메인 페이지는 발표용 요약 역할을 하고, 상세 설명은 문서 페이지로 분리됩니다.

- [문서 안내]({{ '/documents/greeting/' | relative_url }})
- [문서 구조와 링크]({{ '/documents/greeting/site-map/' | relative_url }})
- [서비스 가이드]({{ '/documents/service/' | relative_url }})
- [사용자 흐름]({{ '/documents/service/user-flow/' | relative_url }})
- [주요 기능]({{ '/documents/service/features/' | relative_url }})
- [개발 가이드]({{ '/documents/development/' | relative_url }})
- [시스템 구조]({{ '/documents/development/architecture/' | relative_url }})
- [개발 환경 설정]({{ '/documents/development/setup/' | relative_url }})
- [기술 스택]({{ '/documents/development/tech-stack/' | relative_url }})
