import React from 'react';

interface VideoModalProps {
  url: string | null;
  onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ url, onClose }) => {
  if (!url) return null;

  let embedUrl = url;
  if (url.includes('youtube.com/watch?v=')) {
    embedUrl = url.replace('watch?v=', 'embed/');
  } else if (url.includes('youtu.be/')) {
    embedUrl = url.replace('youtu.be/', 'youtube.com/embed/');
  } else if (url.includes('youtube.com/shorts/')) {
    embedUrl = url.replace('youtube.com/shorts/', 'youtube.com/embed/');
  } else if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/d\/(.*?)\//);
    if (match) embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl relative border border-zinc-800">
        <div className="flex justify-between items-center p-4 bg-zinc-950/60 border-b border-zinc-800/50">
          <h3 className="text-white font-extrabold text-xs flex items-center gap-2">
            <i className="fa-solid fa-video text-emerald-500" /> Esecuzione Tecnica
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white bg-zinc-800 w-8 h-8 flex items-center justify-center rounded-full transition outline-none"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>
        <div className="w-full aspect-video bg-black relative">
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={embedUrl}
            title="Video Esercizio"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};
