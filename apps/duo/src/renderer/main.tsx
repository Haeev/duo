import '@fontsource-variable/jost/wght.css';
import '@fontsource-variable/dm-sans/standard.css';
import '../../../../design/identite/b/jetons.css';
import './styles/app.css';
import { render } from 'preact';
import { App } from './app';
import { connectBridge } from './bridge';

const root = document.getElementById('app');
if (root !== null) {
  connectBridge();
  render(<App />, root);
}
