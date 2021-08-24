import React, { useEffect, useState } from 'react'
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import { format } from 'date-fns'

let ffmpeg: any = null;
let currentVideo: any = null;
let mediaRecorder: any = null;
let chunks: any[] = [];

declare var MediaRecorder: any;

function download(dataurl: string, filename: string): void {
  var a = document.createElement("a");
  a.href = dataurl;
  a.setAttribute("download", filename);
  a.click();
}

function App() {
  const [recording, setRecording] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [message, setMessage] = useState<string>('');

  const addLog = (str: string): void => {
    setLogs(logs => [...logs, str])
  }
  
  const transcode = async (arrayBuffer: ArrayBuffer, name: string): Promise<void> => {
    if (loading) return;
    addLog(`Starting transcode`)
    setLoading(true);

    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    const newName = `${name}.mp4`;

    ffmpeg.FS('writeFile', 'record.webm', await fetchFile(arrayBuffer as Buffer));

    addLog(`Transcoding...`)

    await ffmpeg.run('-i', 'record.webm', newName);

    const data = ffmpeg.FS('readFile', newName);

    const newFile = new File([new Blob([data.buffer], { type: 'video/mp4' })], newName, {
      type: 'video/mp4',
      lastModified: +new Date(),
    })

    const newVideoURL = URL.createObjectURL(newFile);

    download(newVideoURL, newName)
    
    setLoading(false);
    addLog(`Finished`)
  }

  const startRecord = async () => {
    setLogs([])
    setMessage('');
    if(!navigator || !navigator.mediaDevices || !(navigator.mediaDevices as any).getDisplayMedia) {
      alert(`Your Browser does not support Screen Recording yet.`)
      return;
    }

    setRecording(true);
    try {
      addLog(`Starting record`)
      chunks = []
      currentVideo = await (navigator.mediaDevices as any).getDisplayMedia(
        {
          video: {
            cursor: "always",
            displaySurface: 'application, browser, monitor, window',
            logicalSurface: true,
            frameRate: {
              ideal: 7,
              max: 11
            },
            width: { ideal: 1080, max: 1080 },
            height: { ideal: 720, max: 720 }
          },
          audio: true
        }
      );

      const audioTrack = await navigator.mediaDevices.getUserMedia(
        {
            audio: true,
        }
      );

      currentVideo.addTrack(audioTrack.getAudioTracks()[0]);

      currentVideo.getVideoTracks()[0].addEventListener('ended', (event: any) => {
        stopRecord(event);
      });
      currentVideo.addEventListener('inactive', (event: any) => {
        stopRecord(event);
      });

      mediaRecorder = new MediaRecorder(currentVideo, {
        mimeType: 'video/webm;',
      });

      mediaRecorder.addEventListener('dataavailable', (event: any) => {
        if (event.data && event.data.size > 0) {
          console.log(`Adding CHUNK`)
          chunks.push(event.data);
        }
      });

      mediaRecorder.addEventListener('inactive', () => {
        mediaRecorder.stop();
      });

      mediaRecorder.onstop = async () => transcode(new Uint8Array(await (new Blob(chunks)).arrayBuffer()), format(new Date(), "yyyy-MM-dd'-'HH'.'mm'.'ss"))

      
      mediaRecorder.start();
      addLog(`Recording...`)
    } catch (err) {
      alert(err)
      switch (err.name){
        case "NotAllowedError":
          alert(`No Permissions to Record your Screen or you canceled the Recording.`)
          break;
        case "NotSupportedError":
          alert(`Your Browser does not support Screen Recording yet.`)
          break;
        default:
          alert(JSON.stringify(err, null, 2));
          break;
      }
      addLog(`Failed ${JSON.stringify(err, null, 2)}`)
    }
  }

  const stopRecord = async (e: any) => {
    if (!recording) return;
    setRecording(false);
    addLog(`Recording stopped`)
    const tracks = currentVideo.getTracks();
    tracks.forEach((t: any) => t.stop());
    mediaRecorder.stop();
  }

  useEffect(() => {
    if (ffmpeg === null) {
      ffmpeg = createFFmpeg({
        log: true,
      });
      ffmpeg.setLogger(({ type, message }: any) => {
        if (type !== 'info') {
          setMessage(message);
        }
      });
    }
  }, [])

  return (
    <div className="App">
      {recording 
        ? <button onClick={stopRecord} disabled={loading}>Stop record</button> 
        : <button onClick={startRecord} disabled={loading}>Start record</button>
      }
      <br />
      <br />
      <span>Transcode stage: {message}</span>
      <br />
      <br />
      <h3>Logs</h3>
      <br />
      <br />
      {logs.map((log, i) => (
        <>
          <span key={i}>{log}</span>
          <br/>
        </>
      ))}
    </div>
  );
}

export default App;
