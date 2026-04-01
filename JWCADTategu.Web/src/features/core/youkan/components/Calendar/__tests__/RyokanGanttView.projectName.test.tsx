import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { Item } from '../../../types';

/**
 * ガント一覧モード（showGroups=false）でプロジェクト名を表示するテスト
 */

const makeAllDays = (): Date[] => {
	const days: Date[] = [];
	for (let d = 1; d <= 31; d++) {
		days.push(new Date(2026, 2, d));
	}
	return days;
};

const makeItem = (id: string, title: string, projectId?: string | null): Item => ({
	id,
	title,
	status: 'inbox',
	focusOrder: 0,
	isEngaged: false,
	statusUpdatedAt: 0,
	interrupt: false,
	weight: 2,
	parentId: null,
	projectId: projectId ?? null,
	createdAt: 0,
	updatedAt: 0,
	memo: '',
	due_date: '',
	flags: {},
});

const makeProject = (id: string, title: string): any => ({
	id,
	title,
	isProject: true,
	type: 'project',
	status: 'inbox',
	focusOrder: 0,
	isEngaged: false,
	statusUpdatedAt: 0,
	interrupt: false,
	weight: 2,
	parentId: null,
	projectId: null,
	createdAt: 0,
	updatedAt: 0,
	memo: '',
	due_date: '',
	flags: {},
	isArchived: false,
});

const defaultProps = {
	allDays: makeAllDays(),
	heatMap: new Map(),
	today: new Date(2026, 2, 15),
	safeConfig: {},
	rowHeight: 40,
	renderItemTitle: (item: Item) => item.title,
};

describe('ガント一覧モード（showGroups=false）でプロジェクト名表示', () => {
	it('showGroups=false のとき、projectTitleを持つアイテムにプロジェクト名が表示される', () => {
		const projects = [makeProject('prj-1', 'ウェブサイト構築')];
		const items = [
			{ ...makeItem('task-1', 'デザイン作成', 'prj-1'), projectTitle: 'ウェブサイト構築' },
			makeItem('task-2', '個人タスク'),
		];

		render(
			<RyokanGanttView
				{...defaultProps}
				items={items}
				projects={projects}
				showGroups={false}
			/>
		);

		const label = screen.getByTestId('project-label-task-1');
		expect(label).toHaveTextContent('[ウェブサイト構築]');
		expect(screen.queryByTestId('project-label-task-2')).toBeNull();
	});

	it('showGroups=true のとき、アイテム行にプロジェクト名ラベルが表示されない', () => {
		const projects = [makeProject('prj-1', 'ウェブサイト構築')];
		const items = [
			makeItem('task-1', 'デザイン作成', 'prj-1'),
		];

		render(
			<RyokanGanttView
				{...defaultProps}
				items={items}
				projects={projects}
				showGroups={true}
			/>
		);

		expect(screen.queryByTestId('project-label-task-1')).toBeNull();
	});

	it('item.projectTitleがwrapper.project.titleより優先される（別テナント混入防止）', () => {
		// バックエンドのJOINで正しいプロジェクト名がprojectTitleに入っている場合、
		// hierarchy.tsのprojectContextよりもprojectTitleを優先する
		const projects = [makeProject('prj-1', '総会')];
		const items = [
			{ ...makeItem('task-1', 'テスト作業', 'prj-1'), projectTitle: '佐礼谷プロジェクト' },
		];

		render(
			<RyokanGanttView
				{...defaultProps}
				items={items}
				projects={projects}
				showGroups={false}
			/>
		);

		const label = screen.getByTestId('project-label-task-1');
		expect(label).toHaveTextContent('[佐礼谷プロジェクト]');
	});

	it('showGroups=false でプロジェクトに属さないアイテムにはプロジェクト名が表示されない', () => {
		const projects = [makeProject('prj-1', 'ウェブサイト構築')];
		const items = [
			makeItem('task-1', '個人タスク'),
		];

		render(
			<RyokanGanttView
				{...defaultProps}
				items={items}
				projects={projects}
				showGroups={false}
			/>
		);

		expect(screen.queryByTestId('project-label-task-1')).toBeNull();
	});

	it('item.projectTitleがnullでwrapper.projectがある場合でもフォールバック表示しない', () => {
		const projects = [makeProject('prj-1', '総会')];
		const items = [
			makeItem('task-1', 'テスト作業', 'prj-1'),
		];
		// projectTitleがundefined（バックエンドからの応答にない場合）

		render(
			<RyokanGanttView
				{...defaultProps}
				items={items}
				projects={projects}
				showGroups={false}
			/>
		);

		// wrapper.projectへのフォールバックが無効なので、projectTitleがないアイテムにはラベルなし
		expect(screen.queryByTestId('project-label-task-1')).toBeNull();
	});

	it('item.projectTitleがある場合のみプロジェクト名が表示される', () => {
		const projects = [makeProject('prj-1', '総会')];
		const items = [
			{ ...makeItem('task-1', 'テスト作業', 'prj-1'), projectTitle: '佐礼谷プロジェクト' },
		];

		render(
			<RyokanGanttView
				{...defaultProps}
				items={items}
				projects={projects}
				showGroups={false}
			/>
		);

		const label = screen.getByTestId('project-label-task-1');
		expect(label).toHaveTextContent('[佐礼谷プロジェクト]');
	});
});
