const API_KEY = 'AIzaSyCK_TwOWPMLtv7ThujUlrI3_sTtADEJ6lc'; 

let ONLINE_LIVES = []; 
let currentIndex = 0;

const playerContainer = document.getElementById('video-player-container');
const chatContainer = document.getElementById('chat-container');
const sideWrapper = document.getElementById('side-wrapper');
const liveListUl = document.getElementById('live-list-ul');
const liveTitle = document.getElementById('live-title');
const loadingOverlay = document.getElementById('loading');

// パネルとタブの要素取得
const paneList = document.getElementById('pane-list');
const paneChat = document.getElementById('pane-chat');
const listTab = document.getElementById('list-tab');
const chatTab = document.getElementById('chat-tab');

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
        const videoUrl = `https://www.youtube.com/embed/..?` // ダミー、下の本処理用
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
            updateStage(0);
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
    playerContainer.innerHTML = "";
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
            updateStage(index);
        });
        liveListUl.appendChild(li);
    });
}

function updateStage(index) {
    if (ONLINE_LIVES.length === 0) return;
    
    document.querySelectorAll('.live-item').forEach(el => el.classList.remove('active'));
    const currentListItem = document.getElementById(`live-item-${index}`);
    if (currentListItem) currentListItem.classList.add('active');

    currentIndex = index;
    const live = ONLINE_LIVES[currentIndex];
    
    liveTitle.innerHTML = `${live.title} <span id="channel-name">[${live.channelTitle}]</span>`;

    const videoUrl = `https://www.youtube.com/embed/${live.videoId}?autoplay=1&mute=1`;
    const chatUrl = `https://www.youtube.com/live_chat?v=${live.videoId}&embed_domain=${window.location.hostname}`;

    playerContainer.innerHTML = `<iframe src="${videoUrl}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    chatContainer.innerHTML = `<iframe src="${chatUrl}"></iframe>`;
}

// 🟢 共通サイドコンテナの開閉・切り替えロジック
function toggleSideContainer(targetType) {
    const isContainerOpen = sideWrapper.classList.contains('open');
    const isCurrentActive = (targetType === 'list' && listTab.classList.contains('active')) || 
                            (targetType === 'chat' && chatTab.classList.contains('active'));

    // 1. すでに開いていて、かつ「同じタブ」が押されたら閉じる
    if (isContainerOpen && isCurrentActive) {
        sideWrapper.classList.remove('open');
        listTab.classList.remove('active');
        chatTab.classList.remove('active');
        return;
    }

    // 2. タブのハイライトの切り替え
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

    // 3. コンテナを確実に開く
    sideWrapper.classList.add('open');
}

// 各タブのクリックイベント登録
listTab.addEventListener('click', () => toggleSideContainer('list'));
chatTab.addEventListener('click', () => toggleSideContainer('chat'));

// シャッフルボタン
document.getElementById('shuffle-btn').addEventListener('click', () => {
    if (ONLINE_LIVES.length <= 1) return;
    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * ONLINE_LIVES.length);
    } while (randomIndex === currentIndex);
    updateStage(randomIndex);
});

// リログボタン
document.getElementById('relog-btn').addEventListener('click', () => {
    fetchOnlineLives();
});

// 起動
fetchOnlineLives();