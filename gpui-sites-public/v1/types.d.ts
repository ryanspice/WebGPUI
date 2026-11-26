// TypeScript types for the GPUI Web SDK facade (P0).
// Import from 'https://ryanspice.com/dev/gpui/v1/gpui.mjs'.

export interface GpuiStyle {
  [key: string]: unknown;
}

export interface GpuiElement {
  type: 'column' | 'row' | 'view' | 'text' | 'button' | 'input';
  props: Record<string, unknown>;
  children: GpuiChild[];
}

export type GpuiChild = GpuiElement | string | number | null | undefined;

export interface InputProps {
  value?: string;
  placeholder?: string;
  style?: GpuiStyle;
  onChange?: (event: { value?: string }) => void;
}

export interface ButtonProps {
  style?: GpuiStyle;
  disabled?: boolean;
}

export interface ContainerProps {
  style?: GpuiStyle;
}

export interface MountConfig {
  initialState?: Record<string, unknown>;
  view: (state: any, update: (patch: Record<string, unknown>) => void) => GpuiChild;
  title?: string;
  width?: number;
  height?: number;
}

export interface GpuiWindowRoot {
  render: (node: unknown, options?: Record<string, unknown>) => void;
  unmount: () => void;
  close: () => void;
  readonly closed: boolean;
}

export declare const ui: {
  column(props?: ContainerProps, children?: GpuiChild[]): GpuiElement;
  row(props?: ContainerProps, children?: GpuiChild[]): GpuiElement;
  view(props?: ContainerProps, children?: GpuiChild[]): GpuiElement;
  text(value: string | number, props?: Record<string, unknown>): GpuiElement;
  button(label: string, onPress: () => void, props?: ButtonProps): GpuiElement;
  input(props?: InputProps): GpuiElement;
};

export declare function mount(config: MountConfig): Promise<GpuiWindowRoot>;
export declare function initGpuiWeb(): Promise<void>;
export declare function resetRender(): void;
export declare const version: string;