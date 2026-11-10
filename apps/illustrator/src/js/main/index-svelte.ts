import { mount } from 'svelte';
import '@compasso/ui/fonts.css';
import '@compasso/ui/tokens.css';
import { initBolt } from '../lib/utils/bolt';
import App from './main.svelte';

initBolt();

mount(App, { target: document.getElementById('app')! });
