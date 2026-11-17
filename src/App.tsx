/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FlappyGame } from './components/FlappyGame';

export default function App() {
  return (
    <main className="min-h-dvh w-full bg-slate-100 flex flex-col items-center justify-center px-4 py-4">
      <FlappyGame />
    </main>
  );
}

