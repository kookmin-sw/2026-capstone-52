import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";

config.autoAddCss = false;

export const metadata = {
  title: "eeum | AI 튜터 워크스페이스",
  description: "프로젝트별 학습 워크스페이스와 수준진단을 제공하는 eeum 프론트엔드"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
