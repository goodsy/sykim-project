import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";

export default function Home() {
    return (
        <Layout title="goodsy" description="결제 정산·배치 시스템 백엔드 개발">
            <main style={{ maxWidth: 760, margin: "0 auto", padding: "4.5rem 1.5rem" }}>
                <h1 style={{ fontSize: "2.2rem", color: "#4B2E83", marginBottom: "0.6rem" }}>
                    goodsy’s 개발 기록
                </h1>

                <p style={{ color: "var(--ifm-color-emphasis-700)", lineHeight: 1.7, marginBottom: "1.8rem" }}>
                    백엔드 개발 업무를 하며 정리한 기술과 작업 기록입니다.<br/>
                    실무에서 마주한 문제, 선택의 이유, 구현 과정을 중심으로 정리합니다.<br/>
                </p>
                <section style={{ marginTop: "2.5rem" }}>
                    <h3>Tech</h3>
                    <p>
                        설계, 코드, 성능, 트러블슈팅 등<br/>
                        백엔드 시스템 개발과 관련된 기술 내용을 기록합니다.
                    </p>
                    <Link to="/blog/tags/tech">→ Tech 글 보기</Link>
                </section>

                <section style={{ marginTop: "2rem" }}>
                    <h3>Worklog</h3>
                    <p>
                        운영, 장애 대응, 협업 과정 등<br/>
                        업무를 진행하며 정리한 작업 기록과 회고입니다.
                    </p>
                    <Link to="/blog/tags/worklog">→ Worklog 글 보기</Link>
                </section>

                <section style={{ marginTop: "2rem" }}>
                    <h3>Notes</h3>
                    <p>
                        문서, 글, 자료 등을 읽고 정리한 내용입니다.<br/>
                        개념 정리와 참고 기록을 중심으로 남깁니다.
                    </p>
                    <Link to="/blog/tags/notes">→ Notes 글 보기</Link>
                </section>

                {/*<div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>*/}
                {/*    <Link className="button button--primary" to="/blog">Blog</Link>*/}
                {/*    <Link className="button button--secondary" to="/tags/tech">Tech</Link>*/}
                {/*    <Link className="button button--secondary" to="/tags/worklog">Worklog</Link>*/}
                {/*    /!*<Link className="button button--secondary" to="/docs">Docs</Link>*!/*/}
                {/*    <Link className="button button--secondary" to="/archive">Archive</Link>*/}
                {/*</div>*/}
            </main>
        </Layout>
    );
}
