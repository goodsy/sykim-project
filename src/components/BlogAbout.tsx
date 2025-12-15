import React from "react";

export function BlogAbout() {
    return (
        <div style={{fontSize: "0.95rem", lineHeight: 1.6}}>
            <h3 style={{marginTop: 0}}>About</h3>
            <p style={{marginBottom: "1rem"}}>
                <strong>정산·배치 백엔드 실무를 차분하게 기록합니다.</strong>
            </p>

            <div style={{marginBottom: "0.75rem"}}>
                <strong>Tech</strong><br/>
                설계, 코드, 트러블슈팅
            </div>

            <div style={{marginBottom: "0.75rem"}}>
                <strong>Worklog</strong><br/>
                운영, 장애 대응, 일의 방식
            </div>

            <div>
                <strong>Notes</strong><br/>
                읽고 배운 것 정리
            </div>
        </div>
    );
}
