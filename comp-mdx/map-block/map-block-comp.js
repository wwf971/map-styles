import { compDefine } from '@wwf971/react-doc';
import { MapBlockObjectEditor } from './MapBlockObjectEditor.jsx';
import { MapBlockObjectView } from './MapBlockObjectView.jsx';

// the modes of a frontend object holding block maps, never written as blocks themselves
// (doc/map-block.md#the-modes)
const modeDefine = (label, description) => ({ placementList: ['objectFrontend'], expose: { meta: { label, description, isNotInDoc: true } } });

export const MapBlockEditorDefine = compDefine(MapBlockObjectEditor, modeDefine('Block map: editor', 'The maps of a partition, and the one shown in the editor'));
export const MapBlockViewDefine = compDefine(MapBlockObjectView, modeDefine('Block map', 'One block map, to look at or to select in'));
