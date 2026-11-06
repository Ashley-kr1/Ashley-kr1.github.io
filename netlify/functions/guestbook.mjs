// Netlify 서버리스 함수 — 방명록 쓰기(저장) 전용
//
// 설계(선택지 B, 과제 지침 기준):
// - 브라우저(anon)는 테이블에 직접 쓰지 못한다(RLS에 anon insert 정책 없음).
// - 쓰기는 반드시 이 서버 함수를 거친다. 함수가 입력을 검사한 뒤 service_role 키로 insert.
// - service_role 키는 RLS를 우회하므로, 입력 검증 책임은 전적으로 이 함수에 있다.
//
// 중요:
// - 이 파일은 publish/ 폴더 바깥(netlify/functions)에 있어 웹에 공개되지 않는다.
// - 환경변수는 Netlify 대시보드(Site configuration > Environment variables)에 넣는다.
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service_role 키는 절대 클라이언트/저장소에 넣지 말 것)
//
// 배포 후 호출 경로: /.netlify/functions/guestbook (POST)

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

  // 허용된 필드만 추출(그 외 필드는 무시). 서버가 입력을 검사한다.
  const nickname = (body.nickname ?? "").toString().trim();
  const message = (body.message ?? "").toString().trim();
  const playerRaw = body.player ? body.player.toString().trim() : "";
  const player = playerRaw.length ? playerRaw : null;

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
  if (player !== null && player.length > 20) {
    return new Response(JSON.stringify({ error: "선수 이름은 20자 이하여야 합니다." }), {
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
