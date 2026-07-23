const fs = require('fs');
const file = 'app/fgd/[sessionId]/FgdRoomClient.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state
const stateToAdd = `  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };
`;

content = content.replace('  const [selectedForFinal, setSelectedForFinal] = useState<number[]>([]);\n', '  const [selectedForFinal, setSelectedForFinal] = useState<number[]>([]);\n' + stateToAdd);

// 2. Replace confirm calls
content = content.replace(
  "if (!confirm('Hapus dokumen tambahan ini?')) return;",
  "showConfirm('Hapus Dokumen?', 'Hapus dokumen tambahan ini?', async () => {\n      try {"
);

// We need to fix the rest of handleDeleteDoc
// Let's replace handleDeleteDoc entirely for safety.
