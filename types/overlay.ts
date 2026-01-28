export interface OverlayObject {
  id: string
  page: number
  type: 'text' | 'image' | 'shape' | 'highlight' | 'drawing'
  x: number
  y: number
  width?: number
  height?: number
  rotation?: number
  data: Record<string, any>
}

export interface TextOverlay extends OverlayObject {
  type: 'text'
  data: {
    text: string
    fontSize: number
    fontFamily?: string
    color: string
    fontWeight?: string
    fontStyle?: string
  }
}

export interface ImageOverlay extends OverlayObject {
  type: 'image'
  data: {
    src: string
    opacity?: number
  }
}

export interface ShapeOverlay extends OverlayObject {
  type: 'shape'
  data: {
    shape: 'rectangle' | 'circle' | 'line'
    fill?: string
    stroke?: string
    strokeWidth?: number
  }
}

export interface HighlightOverlay extends OverlayObject {
  type: 'highlight'
  data: {
    color: string
    opacity: number
  }
}

export interface DrawingOverlay extends OverlayObject {
  type: 'drawing'
  data: {
    path: string
    stroke: string
    strokeWidth: number
  }
}

export interface OverlayState {
  objects: OverlayObject[]
  currentPage: number
  totalPages: number
  scale: number
}
