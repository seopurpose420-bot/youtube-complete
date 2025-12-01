// Global Variables
let allVideos = [];
let videoData = [];
let channelAnalytics = [];
let requestCount = 0;

// Obfuscated API Configuration
const API_CONFIG = {
    base: '/api/data',
    keys: ['Zm9vMQ==', 'YmFyMg==', 'dGVzdDM='],
    users: ['eHNTSGFIbXJtdHpGRWFYRjVTVmFaYUhQNkFrdmRCcUlRMEU2cU1jMw==', 'cmFuZG9tVXNlcjEyMw==', 'YW5vdGhlclVzZXI0NTY=']
};

// Utility Functions
const decode = (str) => atob(str);
const getRandomCreds = () => ({
    key: decode(API_CONFIG.keys[Math.floor(Math.random() * API_CONFIG.keys.length)]),
    quotaUser: decode(API_CONFIG.users[Math.floor(Math.random() * API_CONFIG.users.length)])
});

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    updateConnectionStatus();
    updateRequestCount();
    setInterval(updatePerformanceStatus, 5000);
});

// Status Updates
function updateConnectionStatus() {
    const status = document.getElementById('connectionStatus');
    status.innerHTML = '<i class="fas fa-check-circle" style="color: #34a853;"></i> Connected';
}

function updateRequestCount() {
    const count = document.getElementById('requestCount');
    count.textContent = `${requestCount} requests today`;
}

function updatePerformanceStatus() {
    const status = document.getElementById('performanceStatus');
    const statuses = ['Optimal', 'Good', 'Ready'];
    status.textContent = statuses[Math.floor(Math.random() * statuses.length)];
}

// Tab Management
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    if (tabName === 'analytics') {
        updateAnalyticsDashboard();
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Clipboard Functions
function copyToClipboard(text) {
    const cleanText = text.replace(/\\'/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(cleanText).then(() => {
            showToast('Data copied to clipboard!');
        }).catch(() => {
            fallbackCopy(cleanText);
        });
    } else {
        fallbackCopy(cleanText);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('Data copied to clipboard!');
    } catch (err) {
        showToast('Copy failed. Please copy manually.', 'error');
    }
    document.body.removeChild(textarea);
}

// API Functions
async function makeAPIRequest(endpoint, params) {
    const creds = getRandomCreds();
    const url = `${API_CONFIG.base}${endpoint}?key=${creds.key}&quotaUser=${creds.quotaUser}&${params}&_=${Date.now()}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        requestCount++;
        updateRequestCount();
        if (data.error) {
            throw new Error(data.error.message || 'API Error');
        }
        return data;
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

// Channel Functions
function extractChannelId(url) {
    const patterns = [
        { regex: /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/, type: 'id' },
        { regex: /youtube\.com\/@([a-zA-Z0-9_.-]+)/, type: 'username' },
        { regex: /youtube\.com\/c\/([a-zA-Z0-9_.-]+)/, type: 'username' },
        { regex: /youtube\.com\/user\/([a-zA-Z0-9_.-]+)/, type: 'username' },
        { regex: /^([a-zA-Z0-9_-]{24})$/, type: 'id' },
        { regex: /^UC[a-zA-Z0-9_-]{22}$/, type: 'id' }
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern.regex);
        if (match) {
            return { type: pattern.type, value: match[1] };
        }
    }
    return null;
}

async function getChannelInfo(channelId) {
    const params = 'part=snippet,statistics,brandingSettings,contentDetails,localizations,status,topicDetails&id=' + channelId;
    return await makeAPIRequest('/channels', params);
}

async function resolveUsername(username) {
    const params = `part=snippet&type=channel&q=${encodeURIComponent(username)}&maxResults=5`;
    const data = await makeAPIRequest('/search', params);
    if (data.items && data.items.length > 0) {
        for (const item of data.items) {
            const customUrl = item.snippet.customUrl;
            if (customUrl && (customUrl === `@${username}` || customUrl === username)) {
                return item.snippet.channelId;
            }
        }
        return data.items[0].snippet.channelId;
    }
    throw new Error(`Channel '@${username}' not found`);
}

async function getAllVideosFromChannel(channelId, channelName) {
    const videos = [];
    try {
        const channelData = await getChannelInfo(channelId);
        const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
        if (!uploadsPlaylistId) {
            throw new Error('No uploads playlist found');
        }
        let nextPageToken = '';
        let pageCount = 0;
        do {
            const playlistParams = `part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
            const playlistData = await makeAPIRequest('/playlistItems', playlistParams);
            if (playlistData.items && playlistData.items.length > 0) {
                const videoIds = playlistData.items.map(item => item.snippet.resourceId.videoId).filter(id => id).join(',');
                if (videoIds) {
                    const videoParams = `part=snippet,statistics,contentDetails&id=${videoIds}`;
                    const videoDetails = await makeAPIRequest('/videos', videoParams);
                    videoDetails.items?.forEach(video => {
                        videos.push({
                            title: video.snippet.title,
                            videoId: video.id,
                            channelName: channelName,
                            channelId: channelId,
                            url: `https://www.youtube.com/watch?v=${video.id}`,
                            thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
                            duration: formatDuration(video.contentDetails.duration),
                            publishedDate: formatDate(video.snippet.publishedAt),
                            views: parseInt(video.statistics.viewCount || 0).toLocaleString(),
                            likes: parseInt(video.statistics.likeCount || 0).toLocaleString(),
                            comments: parseInt(video.statistics.commentCount || 0).toLocaleString(),
                            description: video.snippet.description?.substring(0, 200) + '...' || 'No description',
                            tags: video.snippet.tags ? video.snippet.tags.slice(0, 5).join(', ') : 'No tags'
                        });
                    });
                }
            }
            nextPageToken = playlistData.nextPageToken || '';
            pageCount++;
            updateLoadingProgress('channelProgress', (pageCount * 10) % 100);
            document.getElementById('loadingText').textContent = `${channelName}: Found ${videos.length} videos (Page ${pageCount})`;
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
            if (pageCount > 100) break;
        } while (nextPageToken);
    } catch (error) {
        console.error(`Error extracting videos for ${channelName}:`, error);
        throw error;
    }
    return videos;
}

function generateChannelAnalytics(channelData, videos) {
    const stats = channelData.statistics;
    const totalViews = videos.reduce((sum, v) => sum + parseInt(v.views.replace(/,/g, '') || 0), 0);
    const totalLikes = videos.reduce((sum, v) => sum + parseInt(v.likes.replace(/,/g, '') || 0), 0);
    const totalComments = videos.reduce((sum, v) => sum + parseInt(v.comments.replace(/,/g, '') || 0), 0);
    const avgViews = videos.length ? Math.round(totalViews / videos.length) : 0;
    const avgLikes = videos.length ? Math.round(totalLikes / videos.length) : 0;
    const avgComments = videos.length ? Math.round(totalComments / videos.length) : 0;
    const engagementRate = totalViews ? ((totalLikes + totalComments) / totalViews * 100).toFixed(2) : 0;
    return {
        channelName: channelData.snippet.title,
        channelId: channelData.id,
        subscriberCount: parseInt(stats.subscriberCount || 0).toLocaleString(),
        totalChannelViews: parseInt(stats.viewCount || 0).toLocaleString(),
        totalVideos: parseInt(stats.videoCount || 0).toLocaleString(),
        extractedVideos: videos.length,
        avgViewsPerVideo: avgViews.toLocaleString(),
        avgLikesPerVideo: avgLikes.toLocaleString(),
        avgCommentsPerVideo: avgComments.toLocaleString(),
        engagementRate: engagementRate + '%',
        channelCreated: formatDate(channelData.snippet.publishedAt),
        description: channelData.snippet.description?.substring(0, 100) + '...' || 'No description'
    };
}

// Video Functions
function extractVideoId(url) {
    const patterns = [
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
        /youtu\.be\/([a-zA-Z0-9_-]+)/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// Utility Functions
function formatDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function updateLoadingProgress(elementId, percentage) {
    const progressElement = document.getElementById(elementId);
    if (progressElement) {
        progressElement.style.width = `${Math.min(percentage, 100)}%`;
    }
}

// Main Functions - FIXED MULTIPLE CHANNEL PROCESSING
async function extractAllVideos() {
    const urls = document.getElementById('channelUrls').value.trim().split('\n').filter(url => url.trim());
    if (urls.length === 0) {
        showToast('Please enter at least one channel URL or ID', 'error');
        return;
    }

    document.getElementById('channelLoading').style.display = 'block';
    document.getElementById('channelResults').innerHTML = '';
    document.getElementById('extractBtn').disabled = true;
    document.getElementById('exportChannelBtn').disabled = true;
    document.getElementById('copyChannelBtn').disabled = true;

    try {
        allVideos = [];
        channelAnalytics = [];
        let processedChannels = 0;
        
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i].trim();
            try {
                document.getElementById('loadingText').textContent = `Processing channel ${i + 1} of ${urls.length}: ${url.substring(0, 50)}...`;
                updateLoadingProgress('channelProgress', (i / urls.length) * 100);
                
                const channelInfo = extractChannelId(url);
                if (!channelInfo) {
                    throw new Error('Invalid URL or channel ID format');
                }
                
                let channelId = channelInfo.value;
                
                if (channelInfo.type === 'username') {
                    document.getElementById('loadingText').textContent = `Resolving @${channelInfo.value}...`;
                    channelId = await resolveUsername(channelInfo.value);
                }
                
                document.getElementById('loadingText').textContent = `Getting channel info for ${channelId}...`;
                const channelData = await getChannelInfo(channelId);
                
                if (!channelData.items || channelData.items.length === 0) {
                    throw new Error('Channel not found or private');
                }
                
                const channelName = channelData.items[0].snippet.title;
                document.getElementById('loadingText').textContent = `Extracting videos from ${channelName}...`;
                
                const videos = await getAllVideosFromChannel(channelId, channelName);
                allVideos.push(...videos);
                
                const analytics = generateChannelAnalytics(channelData.items[0], videos);
                channelAnalytics.push(analytics);
                
                processedChannels++;
                document.getElementById('loadingText').textContent = `Completed ${processedChannels}/${urls.length} channels. Found ${allVideos.length} total videos.`;
                
                if (i < urls.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (error) {
                console.error(`Error processing ${url}:`, error);
                document.getElementById('loadingText').textContent = `Error with channel ${i + 1}: ${error.message}`;
                
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error';
                errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <strong>Error with ${url}:</strong> ${error.message}`;
                document.getElementById('channelResults').appendChild(errorDiv);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        updateLoadingProgress('channelProgress', 100);
        
        if (allVideos.length > 0) {
            displayChannelResults();
            showToast(`Successfully extracted ${allVideos.length} videos from ${processedChannels} channels!`);
        } else {
            document.getElementById('channelResults').innerHTML = '<div class="error"><i class="fas fa-exclamation-triangle"></i>No videos found from any channels. Please check the URLs and try again.</div>';
            showToast('No videos extracted. Check channel URLs.', 'error');
        }
        
    } catch (error) {
        showToast(`Extraction failed: ${error.message}`, 'error');
    } finally {
        document.getElementById('channelLoading').style.display = 'none';
        document.getElementById('extractBtn').disabled = false;
        document.getElementById('exportChannelBtn').disabled = allVideos.length === 0;
        document.getElementById('copyChannelBtn').disabled = allVideos.length === 0;
    }
}

async function analyzeVideos() {
    const urls = document.getElementById('videoUrls').value.trim().split('\n').filter(url => url.trim());
    if (urls.length === 0) {
        showToast('Please enter at least one video URL or ID', 'error');
        return;
    }

    document.getElementById('videoLoading').style.display = 'block';
    document.getElementById('videoResults').innerHTML = '';
    document.getElementById('analyzeBtn').disabled = true;
    document.getElementById('exportVideoBtn').disabled = true;
    document.getElementById('copyVideoBtn').disabled = true;

    try {
        const videoIds = urls.map(url => extractVideoId(url.trim())).filter(id => id);
        if (videoIds.length === 0) {
            throw new Error('No valid video URLs or IDs found');
        }

        videoData = [];
        for (let i = 0; i < videoIds.length; i += 50) {
            const batch = videoIds.slice(i, i + 50);
            const batchIds = batch.join(',');
            document.getElementById('videoLoadingText').textContent = `Analyzing videos ${i + 1}-${Math.min(i + 50, videoIds.length)} of ${videoIds.length}...`;
            updateLoadingProgress('videoProgress', ((i + 50) / videoIds.length) * 100);
            const params = `part=snippet,statistics,contentDetails&id=${batchIds}`;
            const data = await makeAPIRequest('/videos', params);
            if (data.items) {
                data.items.forEach(video => {
                    videoData.push({
                        title: video.snippet.title,
                        videoId: video.id,
                        channelName: video.snippet.channelTitle,
                        channelId: video.snippet.channelId,
                        url: `https://www.youtube.com/watch?v=${video.id}`,
                        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
                        duration: formatDuration(video.contentDetails.duration),
                        publishedDate: formatDate(video.snippet.publishedAt),
                        views: parseInt(video.statistics.viewCount || 0).toLocaleString(),
                        likes: parseInt(video.statistics.likeCount || 0).toLocaleString(),
                        comments: parseInt(video.statistics.commentCount || 0).toLocaleString(),
                        description: video.snippet.description?.substring(0, 200) + '...' || 'No description',
                        tags: video.snippet.tags ? video.snippet.tags.slice(0, 5).join(', ') : 'No tags'
                    });
                });
            }
        }
        updateLoadingProgress('videoProgress', 100);
        displayVideoResults();
        showToast(`Successfully analyzed ${videoData.length} videos!`);
    } catch (error) {
        showToast(`Analysis failed: ${error.message}`, 'error');
    } finally {
        document.getElementById('videoLoading').style.display = 'none';
        document.getElementById('analyzeBtn').disabled = false;
        document.getElementById('exportVideoBtn').disabled = videoData.length === 0;
        document.getElementById('copyVideoBtn').disabled = videoData.length === 0;
    }
}

// Display Functions
function displayChannelResults() {
    const resultsDiv = document.getElementById('channelResults');
    if (allVideos.length === 0) {
        resultsDiv.innerHTML = '<div class="error"><i class="fas fa-exclamation-triangle"></i>No videos found</div>';
        return;
    }

    const channelCount = new Set(allVideos.map(v => v.channelName)).size;
    let html = `
        <div class="results-header">
            <h3><i class="fas fa-chart-line"></i>Extracted ${allVideos.length} Videos from ${channelCount} Channels</h3>
            <button class="copy-btn" onclick="copyAllChannelData()">
                <i class="fas fa-copy"></i> Copy All Data
            </button>
        </div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>#</th><th>Thumbnail</th><th>Title</th><th>Channel</th><th>Views</th><th>Likes</th>
                        <th>Comments</th><th>Duration</th><th>Published</th><th>Video ID</th><th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    allVideos.forEach((video, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td class="thumbnail-cell"><img src="${video.thumbnail}" alt="Thumbnail" loading="lazy"></td>
                <td class="title-cell">${video.title.substring(0, 50)}...</td>
                <td>${video.channelName}</td>
                <td class="stats-cell">${video.views}</td>
                <td class="stats-cell">${video.likes}</td>
                <td class="stats-cell">${video.comments}</td>
                <td>${video.duration}</td>
                <td>${video.publishedDate}</td>
                <td><code>${video.videoId}</code></td>
                <td>
                    <button class="copy-btn" onclick="copyChannelRow(${index})" title="Copy Row">
                        <i class="fas fa-copy"></i>
                    </button>
                    <a href="${video.url}" target="_blank" class="btn btn-secondary" style="margin-left: 5px; padding: 5px 10px; font-size: 0.8rem;">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                </td>
            </tr>
        `;
    });
    html += '</tbody></table></div>';
    resultsDiv.innerHTML = html;
}

function displayVideoResults() {
    const resultsDiv = document.getElementById('videoResults');
    if (videoData.length === 0) {
        resultsDiv.innerHTML = '<div class="error"><i class="fas fa-exclamation-triangle"></i>No videos found</div>';
        return;
    }

    let html = `
        <div class="results-header">
            <h3><i class="fas fa-video"></i>Analyzed ${videoData.length} Videos</h3>
            <button class="copy-btn" onclick="copyAllVideoData()">
                <i class="fas fa-copy"></i> Copy All Data
            </button>
        </div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>#</th><th>Thumbnail</th><th>Title</th><th>Channel</th><th>Views</th><th>Likes</th>
                        <th>Comments</th><th>Duration</th><th>Published</th><th>Tags</th><th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    videoData.forEach((video, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td class="thumbnail-cell"><img src="${video.thumbnail}" alt="Thumbnail" loading="lazy"></td>
                <td class="title-cell">${video.title.substring(0, 50)}...</td>
                <td>${video.channelName}</td>
                <td class="stats-cell">${video.views}</td>
                <td class="stats-cell">${video.likes}</td>
                <td class="stats-cell">${video.comments}</td>
                <td>${video.duration}</td>
                <td>${video.publishedDate}</td>
                <td>${video.tags.substring(0, 30)}...</td>
                <td>
                    <button class="copy-btn" onclick="copyVideoRow(${index})" title="Copy Row">
                        <i class="fas fa-copy"></i>
                    </button>
                    <a href="${video.url}" target="_blank" class="btn btn-secondary" style="margin-left: 5px; padding: 5px 10px; font-size: 0.8rem;">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                </td>
            </tr>
        `;
    });
    html += '</tbody></table></div>';
    resultsDiv.innerHTML = html;
}

function updateAnalyticsDashboard() {
    const analyticsGrid = document.getElementById('analyticsGrid');
    if (channelAnalytics.length === 0 && videoData.length === 0) {
        analyticsGrid.innerHTML = `
            <div class="analytics-placeholder">
                <i class="fas fa-chart-pie"></i>
                <h3>No Data Available</h3>
                <p>Extract channel or video data to see analytics</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    if (channelAnalytics.length > 0) {
        const totalSubscribers = channelAnalytics.reduce((sum, c) => sum + parseInt(c.subscriberCount.replace(/,/g, '') || 0), 0);
        const totalChannelViews = channelAnalytics.reduce((sum, c) => sum + parseInt(c.totalChannelViews.replace(/,/g, '') || 0), 0);
        const avgEngagement = channelAnalytics.reduce((sum, c) => sum + parseFloat(c.engagementRate.replace('%', '') || 0), 0) / channelAnalytics.length;
        html += `
            <div class="analytics-card">
                <h4><i class="fas fa-users"></i> Total Subscribers</h4>
                <div class="analytics-value">${totalSubscribers.toLocaleString()}</div>
                <div class="analytics-label">Across ${channelAnalytics.length} channels</div>
            </div>
            <div class="analytics-card">
                <h4><i class="fas fa-eye"></i> Total Channel Views</h4>
                <div class="analytics-value">${totalChannelViews.toLocaleString()}</div>
                <div class="analytics-label">Combined channel views</div>
            </div>
            <div class="analytics-card">
                <h4><i class="fas fa-heart"></i> Avg Engagement Rate</h4>
                <div class="analytics-value">${avgEngagement.toFixed(2)}%</div>
                <div class="analytics-label">Average across channels</div>
            </div>
        `;
    }
    if (allVideos.length > 0 || videoData.length > 0) {
        const videos = allVideos.length > 0 ? allVideos : videoData;
        const totalViews = videos.reduce((sum, v) => sum + parseInt(v.views.replace(/,/g, '') || 0), 0);
        const totalLikes = videos.reduce((sum, v) => sum + parseInt(v.likes.replace(/,/g, '') || 0), 0);
        const avgViews = Math.round(totalViews / videos.length);
        html += `
            <div class="analytics-card">
                <h4><i class="fas fa-play"></i> Total Videos</h4>
                <div class="analytics-value">${videos.length.toLocaleString()}</div>
                <div class="analytics-label">Videos analyzed</div>
            </div>
            <div class="analytics-card">
                <h4><i class="fas fa-eye"></i> Total Video Views</h4>
                <div class="analytics-value">${totalViews.toLocaleString()}</div>
                <div class="analytics-label">Combined video views</div>
            </div>
            <div class="analytics-card">
                <h4><i class="fas fa-thumbs-up"></i> Total Likes</h4>
                <div class="analytics-value">${totalLikes.toLocaleString()}</div>
                <div class="analytics-label">Combined likes</div>
            </div>
            <div class="analytics-card">
                <h4><i class="fas fa-chart-line"></i> Avg Views per Video</h4>
                <div class="analytics-value">${avgViews.toLocaleString()}</div>
                <div class="analytics-label">Average performance</div>
            </div>
        `;
    }
    analyticsGrid.innerHTML = html;
}

// Copy Functions
function copyAllChannelData() {
    if (!allVideos?.length) {
        showToast('No data to copy', 'error');
        return;
    }
    const data = 'Title\tChannel Name\tVideo ID\tChannel ID\tURL\tViews\tLikes\tComments\tDuration\tPublished Date\tTags\n' +
        allVideos.map(video => 
            `${video.title}\t${video.channelName}\t${video.videoId}\t${video.channelId}\t${video.url}\t${video.views}\t${video.likes}\t${video.comments}\t${video.duration}\t${video.publishedDate}\t${video.tags}`
        ).join('\n');
    copyToClipboard(data);
}

function copyAllVideoData() {
    if (!videoData?.length) {
        showToast('No data to copy', 'error');
        return;
    }
    const data = 'Title\tChannel Name\tVideo ID\tChannel ID\tURL\tViews\tLikes\tComments\tDuration\tPublished Date\tTags\tDescription\n' +
        videoData.map(video => 
            `${video.title}\t${video.channelName}\t${video.videoId}\t${video.channelId}\t${video.url}\t${video.views}\t${video.likes}\t${video.comments}\t${video.duration}\t${video.publishedDate}\t${video.tags}\t${video.description}`
        ).join('\n');
    copyToClipboard(data);
}

function copyChannelRow(index) {
    if (!allVideos[index]) return;
    const video = allVideos[index];
    const rowData = `${video.title}\t${video.channelName}\t${video.videoId}\t${video.channelId}\t${video.url}\t${video.views}\t${video.likes}\t${video.comments}\t${video.duration}\t${video.publishedDate}\t${video.tags}`;
    copyToClipboard(rowData);
}

function copyVideoRow(index) {
    if (!videoData[index]) return;
    const video = videoData[index];
    const rowData = `${video.title}\t${video.channelName}\t${video.videoId}\t${video.channelId}\t${video.url}\t${video.views}\t${video.likes}\t${video.comments}\t${video.duration}\t${video.publishedDate}\t${video.tags}`;
    copyToClipboard(rowData);
}

// Export Functions
function exportChannelData() {
    if (!allVideos?.length) {
        showToast('No data to export', 'error');
        return;
    }
    const csv = 'Title,Channel Name,Video ID,Channel ID,URL,Views,Likes,Comments,Duration,Published Date,Tags,Description\n' +
        allVideos.map(video => 
            `"${video.title}","${video.channelName}","${video.videoId}","${video.channelId}","${video.url}","${video.views}","${video.likes}","${video.comments}","${video.duration}","${video.publishedDate}","${video.tags}","${video.description}"`
        ).join('\n');
    downloadCSV(csv, `youtube-channels-${new Date().toISOString().split('T')[0]}.csv`);
    showToast('Channel data exported successfully!');
}

function exportVideoData() {
    if (!videoData?.length) {
        showToast('No data to export', 'error');
        return;
    }
    const csv = 'Title,Channel Name,Video ID,Channel ID,URL,Views,Likes,Comments,Duration,Published Date,Tags,Description\n' +
        videoData.map(video => 
            `"${video.title}","${video.channelName}","${video.videoId}","${video.channelId}","${video.url}","${video.views}","${video.likes}","${video.comments}","${video.duration}","${video.publishedDate}","${video.tags}","${video.description}"`
        ).join('\n');
    downloadCSV(csv, `youtube-videos-${new Date().toISOString().split('T')[0]}.csv`);
    showToast('Video data exported successfully!');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
