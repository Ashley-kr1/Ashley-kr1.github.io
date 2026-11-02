// Netlify 서버리스 함수 (선택 사용)
//
// 이 함수는 "서버 쪽에서만" Supabase에 접근해야 할 때 사용하는 자리입니다.
// 예: 민감한 service_role 키를 브라우저에 노출하지 않고 쓰기를 처리하고 싶을 때.
//
// 중요:
// - 이 파일은 publish/ 폴더 바깥(netlify/functions)에 있어 웹에 공개되지 않습니다.
// - 환경변수는 Netlify 대시보드(Site settings > Environment variables)에 넣습니다.
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service_role 키는 절대 클라이언트/저장소에 커밋하지 마세요)
// - MVP 기본 설계는 브라우저에서 anon 키로 직접 호출하는 방식입니다.
//   이 함수는 보안을 더 강화하고 싶을 때 선택적으로 켜는 확장 경로입니다.
//
// 배포 후 호출 경로: /.netlify/functions/guestbook

export default async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST만 허용됩니다." }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(
      JSON.stringify({ error: "서버 환경변수가 설정되지 않았습니다." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "잘못된 요청 본문입니다." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const nickname = (body.nickname ?? "").toString().trim();
  const message = (body.message ?? "").toString().trim();
  const player = body.player ? body.player.toString().trim() : null;

  // 서버 측 입력 검증
  if (nickname.length < 1 || nickname.length > 20) {
    return new Response(JSON.stringify({ error: "닉네임은 1~20자여야 합니다." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (message.length < 1 || message.length > 200) {
    return new Response(JSON.stringify({ error: "메시지는 1~200자여야 합니다." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Supabase REST API로 insert (service_role 키는 서버에서만 사용)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/guestbook`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ nickname, message, player }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return new Response(
      JSON.stringify({ error: "저장에 실패했습니다.", detail }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
};
