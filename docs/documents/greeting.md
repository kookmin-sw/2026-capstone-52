---
layout: default
title: "문서 안내"
nav_order: 2
has_children: true
has_toc: true
permalink: /documents/greeting/
---

# 문서 안내

이 문서는 이음 프로젝트 페이지의 탐색 구조를 설명합니다. 메인 페이지는 프로젝트를 한눈에 소개하고, 상세 문서는 서비스 사용 흐름과 개발 정보를 나누어 제공합니다.

## 문서 구성

- [서비스 가이드]({{ '/documents/service/' | relative_url }})는 사용자가 서비스를 어떻게 이용하는지 설명합니다.
- [개발 가이드]({{ '/documents/development/' | relative_url }})는 시스템 구조, 실행 방법, 기술 스택을 정리합니다.
- [문서 구조와 링크]({{ '/documents/greeting/site-map/' | relative_url }})는 디렉토리 구조, 화면 내비게이션, 본문 링크 흐름을 설명합니다.
- [시스템 구조]({{ '/documents/development/architecture/' | relative_url }})는 현재 아키텍처 이미지를 중심으로 프론트엔드, 백엔드, AI 처리 흐름을 설명합니다.

## 페이지 연결 방식

각 Markdown 파일의 front matter가 사이트 내비게이션을 결정합니다.

```yaml
title: "문서 제목"
parent: "상위 문서 제목"
nav_order: 1
permalink: /documents/example/
```

`parent` 값은 상위 문서의 `title`과 정확히 일치해야 사이드바에서 하위 메뉴로 묶입니다.
