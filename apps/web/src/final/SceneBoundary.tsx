import { Component } from 'react';
import type { ReactNode } from 'react';
export class SceneBoundary extends Component<
  { children: ReactNode; readOnly?: boolean },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="ark-canvas-fallback" role="status">
        <strong>VISUAL LINK UNAVAILABLE</strong>
        <span>The saved game and ship record remain available.</span>
        {!this.props.readOnly && (
          <button
            onClick={() =>
              this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }))
            }
          >
            Retry graphics
          </button>
        )}
      </div>
    ) : (
      <div className="scene-boundary" key={this.state.attempt}>
        {this.props.children}
      </div>
    );
  }
}
