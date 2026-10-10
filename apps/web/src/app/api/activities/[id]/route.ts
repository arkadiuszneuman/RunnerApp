import { NextResponse } from 'next/server';
import { deleteActivity, getActivity, setActivityLink } from '@/lib/activities/repo';
import { getUserId } from '@/lib/session';
import { parseJsonBody, patchActivitySchema } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json(null, { status: 404 });
  const activity = await getActivity(userId, id);
  if (!activity) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(activity);
}

/** Links the activity to a run (`{ linkedRunId }`) or unlinks it (`{ linkedRunId: null }`). */
export async function PATCH(request: Request, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json(null, { status: 404 });
  const parsed = await parseJsonBody(request, patchActivitySchema);
  if (!parsed.ok) return parsed.response;

  const ok = await setActivityLink(userId, id, parsed.data.linkedRunId);
  if (!ok) return NextResponse.json(null, { status: 404 });
  return NextResponse.json({ id });
}

export async function DELETE(request: Request, { params }: Params) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json(null, { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json(null, { status: 404 });
  if (!(await deleteActivity(userId, id))) return NextResponse.json(null, { status: 404 });
  return NextResponse.json({ id });
}
