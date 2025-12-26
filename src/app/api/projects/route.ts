import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import {
  getProjects,
  addProject,
  removeProject,
  setCurrentProject,
  getCurrentProject,
  Project,
} from '@/lib/giz-config';

// GET /api/projects - 프로젝트 목록 조회
export async function GET() {
  try {
    const config = getProjects();
    const current = getCurrentProject();

    return NextResponse.json({
      projects: config.projects,
      currentProject: current,
    });
  } catch (error) {
    console.error('Failed to get projects:', error);
    return NextResponse.json(
      { error: 'Failed to get projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - 프로젝트 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: projectPath, name, id } = body;

    if (!projectPath) {
      return NextResponse.json(
        { error: 'Project path is required' },
        { status: 400 }
      );
    }

    // 경로 존재 확인
    if (!fs.existsSync(projectPath)) {
      return NextResponse.json(
        { error: 'Project path does not exist' },
        { status: 400 }
      );
    }

    const project = addProject(projectPath, name, id);

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Failed to add project:', error);
    return NextResponse.json(
      { error: 'Failed to add project' },
      { status: 500 }
    );
  }
}

// PUT /api/projects - 현재 프로젝트 변경
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const success = setCurrentProject(projectId);

    if (!success) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const current = getCurrentProject();

    return NextResponse.json({ currentProject: current });
  } catch (error) {
    console.error('Failed to set current project:', error);
    return NextResponse.json(
      { error: 'Failed to set current project' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects - 프로젝트 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const success = removeProject(projectId);

    if (!success) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove project:', error);
    return NextResponse.json(
      { error: 'Failed to remove project' },
      { status: 500 }
    );
  }
}
