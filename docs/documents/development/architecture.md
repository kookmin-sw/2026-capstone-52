---
layout: default
title: "시스템 구조"
parent: "개발 가이드"
nav_order: 1
has_toc: true
permalink: /documents/development/architecture/
---

# 시스템 구조

프론트엔드는 학습 프로젝트, 자료 업로드, 진단, 채팅, 지식 그래프 화면을 제공합니다. 백엔드는 인증과 데이터 저장, 파일 업로드 URL 발급, AI 호출을 조율합니다.

업로드된 자료는 스토리지와 분석 파이프라인을 거쳐 요약, 개념, 관계 데이터로 변환됩니다.

## 전체 시스템 흐름

![이음 시스템 아키텍처]({{ '/assets/images/architecture-overview.png' | relative_url }})

## 자료 분석 및 AI 튜터링 흐름

![이음 상세 아키텍처]({{ '/assets/images/architecture-detail.png' | relative_url }})
