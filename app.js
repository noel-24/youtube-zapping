const API_KEY = 'AIzaSyCK_TwOWPMLtv7ThujUlrI3_sTtADEJ6lc'; 

let ONLINE_LIVES = []; 
let currentIndex = 0;
let player = null; // YouTubeプレイヤーのインスタンス保持用

const chatContainer = document.getElementById('chat-container');
const sideWrapper = document.getElementById('side-wrapper');
const liveListUl = document.getElementById('live-list-ul');
const liveTitle = document.getElementById('live-title');
const loadingOverlay = document.getElementById('loading');
const volumeSlider = document.getElementById('volume-slider');

const paneList = document.getElementById('pane-list');
const paneChat = document.getElementById('pane-chat');
const listTab = document.getElementById('list-tab');
const chatTab = document.getElementById('chat-tab');

// YouTube Iframe APIが準備完了したら自動で呼ばれる関数
function onYouTubeIframeAPIReady() {
    fetchOnlineLives();
}

async function fetchOnlineLives() {
    try {
        loadingOverlay.classList.remove('hidden');
        const response = await fetch('channels.json');
        if (!response.ok) throw new Error('channels.json の読み込み失敗');
        const channelIds = await response.json();

        if (channelIds.length === 0) {
            liveTitle.textContent = "チャンネルが登録されていません。";
            return;
        }

        const playlistPromises = channelIds.map(async (channelId) => {
            const uploadPlaylistId = channelId.replace(/^UC/, 'UU');
            const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadPlaylistId}&maxResults=1&key=${API_KEY}`;
            const res = await fetch(playlistUrl);
            const data = await res.json();
            if (data.items && data.items.length > 0) {
                return data.items[0].snippet.resourceId.videoId;
            }
            return null;
        });

        const videoIds = (await Promise.all(playlistPromises)).filter(id => id !== null);

        if (videoIds.length === 0) {
            showNoLive();
            return;
        }

        const videoIdsParam = videoIds.join(',');
        const videoApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoIdsParam}&key=${API_KEY}`;
        const videoRes = await fetch(videoApiUrl);
        const videoData = await videoRes.json();

        if (videoData.error) {
            throw new Error(videoData.error.message);
        }

        ONLINE_LIVES = [];
        if (videoData.items && videoData.items.length > 0) {
            videoData.items.forEach(item => {
                if (item.liveStreamingDetails && item.liveStreamingDetails.actualStartTime && !item.liveStreamingDetails.actualEndTime) {
                    ONLINE_LIVES.push({
                        videoId: item.id,
                        title: item.snippet.title,
                        channelTitle: item.snippet.channelTitle,
                        channelId: item.snippet.channelId
                    });
                }
            });
        }

        loadingOverlay.classList.add('hidden');

        if (ONLINE_LIVES.length > 0) {
            createListView();
            initOrUpdatePlayer(0);
        } else {
            showNoLive();
        }
    } catch (error) {
        console.error(error);
        loadingOverlay.classList.add('hidden');
        liveTitle.textContent = `エラーが発生しました: ${error.message}`;
    }
}

function showNoLive() {
    loadingOverlay.classList.add('hidden');
    liveTitle.textContent = "😢 現在ライブ配信中のチャンネルはありません。";
    if (player) { player.destroy(); player = null; }
    chatContainer.innerHTML = "";
    liveListUl.innerHTML = "<li style='color: #888;'>配信中の番組はありません</li>";
}

function createListView() {
    liveListUl.innerHTML = "";
    ONLINE_LIVES.forEach((live, index) => {
        const li = document.createElement('li');
        li.className = 'live-item';
        li.id = `live-item-${index}`;
        li.innerHTML = `
            <div class="item-title">${live.title}</div>
            <div class="item-channel">📺 ${live.channelTitle}</div>
        `;
        li.addEventListener('click', () => {
            initOrUpdatePlayer(index);
        });
        liveListUl.appendChild(li);
    });
}

// 🟢 プレイヤーの生成または動画の載せ替え処理
function initOrUpdatePlayer(index) {
    if (ONLINE_LIVES.length === 0) return;
    
    document.querySelectorAll('.live-item').forEach(el => el.classList.remove('active'));
    const currentListItem = document.getElementById(`live-item-${index}`);
    if (currentListItem) currentListItem.classList.add('active');

    currentIndex = index;
    const live = ONLINE_LIVES[currentIndex];
    
    liveTitle.innerHTML = `${live.title} <span id="channel-name">[${live.channelTitle}]</span>`;

    // チャット欄はこれまで通りiframeで即座に入れ替え
    const chatUrl = `https://www.youtube.com/live_chat?v=${live.videoId}&embed_domain=${window.location.hostname}`;
    chatContainer.innerHTML = `<iframe src="${chatUrl}"></iframe>`;

    // API経由で音量を制御するため、YT.Playerオブジェクトを作成（または動画をロード）
    const currentVolume = volumeSlider.value;

    if (!player) {
        // 初回：プレイヤーオブジェクトを作成
        player = new YT.Player('youtube-player', {
            videoId: live.videoId,
            playerVars: {
                autoplay: 1,
                mute: 0, // 音量をスライダー側で制御するためミュートはオフ
                controls: 0, // 本家のコントロールバーも非表示に
                rel: 0,
                modestbranding: 1
            },
            events: {
                onReady: (event) => {
                    event.target.setVolume(currentVolume);
                    event.target.playVideo();
                }
            }
        });
    } else {
        // 2回目以降：既存のプレイヤーの動画だけを入れ替える（超高速・シームレス）
        player.loadVideoById({ videoId: live.videoId });
        player.setVolume(currentVolume);
    }
}

// 🟢 音量スライダーの変更イベント（動的にYouTubeの音量を変える）
volumeSlider.addEventListener('input', (e) => {
    if (player && typeof player.setVolume === 'function') {
        player.setVolume(e.target.value);
    }
});

// シャッフルボタン
document.getElementById('shuffle-btn').addEventListener('click', () => {
    if (ONLINE_LIVES.length <= 1) return;
    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * ONLINE_LIVES.length);
    } while (randomIndex === currentIndex);
    initOrUpdatePlayer(randomIndex);
});

// リログボタン
document.getElementById('relog-btn').addEventListener('click', () => {
    fetchOnlineLives();
});

// サイドコンテナの開閉・切り替えロジック
function toggleSideContainer(targetType) {
    const isContainerOpen = sideWrapper.classList.contains('open');
    const isCurrentActive = (targetType === 'list' && listTab.classList.contains('active')) || 
                            (targetType === 'chat' && chatTab.classList.contains('active'));

    if (isContainerOpen && isCurrentActive) {
        sideWrapper.classList.remove('open');
        listTab.classList.remove('active');
        chatTab.classList.remove('active');
        return;
    }

    if (targetType === 'list') {
        listTab.classList.add('active');
        chatTab.classList.remove('active');
        paneList.classList.remove('hidden');
        paneChat.classList.add('hidden');
    } else {
        chatTab.classList.add('active');
        listTab.classList.remove('active');
        paneChat.classList.remove('hidden');
        paneList.classList.add('hidden');
    }

    sideWrapper.classList.add('open');
}

listTab.addEventListener('click', () => toggleSideContainer('list'));
chatTab.addEventListener('click', () => toggleSideContainer('chat'));