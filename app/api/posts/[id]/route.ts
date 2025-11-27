
import { NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

const BOARD_LIST_FILE = path.join(process.cwd(), 'boardList.json');

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const id = parseInt((await params).id);

    try {
        if (!await fs.pathExists(BOARD_LIST_FILE)) {
            return NextResponse.json({ error: 'Database not found' }, { status: 404 });
        }

        const data = await fs.readJson(BOARD_LIST_FILE);
        const postIndex = data.findIndex((item: any) => item.id === id);

        if (postIndex === -1) {
            return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }

        const post = data[postIndex];
        const prevPost = postIndex > 0 ? data[postIndex - 1] : null;
        const nextPost = postIndex < data.length - 1 ? data[postIndex + 1] : null;

        return NextResponse.json({
            ...post,
            prevId: prevPost?.id || null,
            nextId: nextPost?.id || null
        });
    } catch (error) {
        console.error('Error reading boardList.json:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
