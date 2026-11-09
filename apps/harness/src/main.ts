import { mount } from 'svelte';
import '@compasso/ui/fonts.css';
import '@compasso/ui/tokens.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
