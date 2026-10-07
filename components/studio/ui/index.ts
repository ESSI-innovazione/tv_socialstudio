/**
 * I componenti condivisi dello Studio. Ogni pagina li usa al posto di una
 * copia in linea, cosi' una card, un'etichetta di stato o un interruttore
 * sono uguali dappertutto e cambiano in un posto solo.
 */
export { PageHeader, type Crumb } from "./page-header";
export { Card } from "./card";
export { StatusChip, STATUS_CHIP, type ChipStatus } from "./status-chip";
export { ChannelBadge, CHANNEL_LABEL, type ChannelId } from "./channel-badge";
export { SegmentedTabs, type TabItem } from "./segmented-tabs";
export { Toggle } from "./toggle";
export { FieldRow, inputClass, inputStyle } from "./field-row";
export { EmptyState } from "./empty-state";
