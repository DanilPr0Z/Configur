import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Переводчик браузера (Chrome, Яндекс) заменяет текстовые узлы на <font>, и
// React, убирая «свой» узел, падает: «removeChild … не является дочерним» —
// так ломались выбор узла и переключатель «свои» ширины (подтверждено
// имитацией перевода, 07.10.2026). lang="ru" + notranslate в index.html
// перевод не предлагают, но включить его вручную можно. Тогда узел, который
// уже унёс переводчик, просто не трогаем (обход из facebook/react#11538).
const { removeChild, insertBefore } = Node.prototype
Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
  if (child.parentNode !== this) return child
  return removeChild.call(this, child) as T
}
Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
  if (ref && ref.parentNode !== this) return insertBefore.call(this, node, null) as T
  return insertBefore.call(this, node, ref) as T
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
