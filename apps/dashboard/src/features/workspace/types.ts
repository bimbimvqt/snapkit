export type WorkspaceSettings = {
  workspace?: string;
  framework?: 'flutter' | 'react-native' | 'backend';
  spaceId?: string;
  spaceName?: string;
  targetIds: string[];
  target?: string;
  flavor?: string;
  defineFile?: string;
  selectedSetId?: string;
  ideEnabled?: boolean;
};
