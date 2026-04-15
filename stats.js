/**
 * 快记 - 数据统计模块
 * 
 * 功能：
 * 1. 首次输入延迟计时（从页面加载完成到首次按键）
 * 2. 记录完成时间（从开始输入到自动保存完成）
 * 3. 统计数据收集与聚合
 * 4. CSV 格式导出
 */

(function(global) {
    'use strict';

    // ========== 统计数据结构 ==========
    const STATS_KEY = 'quick_task_stats';
    
    // 单次记录的统计数据
    class RecordStats {
        constructor() {
            this.id = Date.now();
            this.timestamp = new Date().toISOString();
            
            // 时间指标（毫秒）
            this.firstInputDelay = null;      // 首次输入延迟：页面加载完成 → 首次按键
            this.recordDuration = null;        // 记录时长：开始输入 → 保存完成
            this.pauseCount = 0;               // 停顿次数（输入中断超过 300ms）
            this.charCount = 0;                // 字符数
            this.saveType = null;              // 保存类型：'pause' | 'max_interval' | 'visibility' | 'manual'
            
            // 内部计时
            this._inputStartTime = null;       // 输入开始时间
            this._lastInputTime = null;        // 最后一次输入时间
        }
    }

    // ========== 统计管理器 ==========
    class StatsManager {
        constructor() {
            this.pageLoadTime = null;          // 页面加载完成时间
            this.currentRecord = null;         // 当前记录的统计数据
            this.history = [];                 // 历史统计记录
            this.isEnabled = true;             // 是否启用统计
            
            this._init();
        }

        _init() {
            // 记录页面加载完成时间
            if (document.readyState === 'complete') {
                this.pageLoadTime = performance.now();
            } else {
                window.addEventListener('load', () => {
                    this.pageLoadTime = performance.now();
                });
            }
            
            // 加载历史统计数据
            this._loadHistory();
        }

        _loadHistory() {
            try {
                const data = localStorage.getItem(STATS_KEY);
                if (data) {
                    this.history = JSON.parse(data);
                }
            } catch (e) {
                console.warn('[Stats] 加载历史统计数据失败:', e);
                this.history = [];
            }
        }

        _saveHistory() {
            try {
                // 只保留最近 1000 条统计记录
                if (this.history.length > 1000) {
                    this.history = this.history.slice(-1000);
                }
                localStorage.setItem(STATS_KEY, JSON.stringify(this.history));
            } catch (e) {
                console.warn('[Stats] 保存统计数据失败:', e);
            }
        }

        // ========== 记录生命周期 ==========

        /**
         * 开始一次新的记录
         * 在用户首次按键时调用
         */
        startRecord() {
            if (!this.isEnabled) return;
            
            this.currentRecord = new RecordStats();
            this.currentRecord._inputStartTime = performance.now();
            this.currentRecord._lastInputTime = this.currentRecord._inputStartTime;
            
            // 计算首次输入延迟
            if (this.pageLoadTime !== null) {
                this.currentRecord.firstInputDelay = Math.round(
                    this.currentRecord._inputStartTime - this.pageLoadTime
                );
            }
            
            console.log('[Stats] 开始记录，首次输入延迟:', this.currentRecord.firstInputDelay, 'ms');
        }

        /**
         * 记录输入事件
         * 用于计算停顿次数
         */
        recordInput(charCount) {
            if (!this.isEnabled || !this.currentRecord) return;
            
            const now = performance.now();
            
            // 检测停顿（超过 300ms 算一次停顿）
            const interval = now - this.currentRecord._lastInputTime;
            if (interval > 300 && this.currentRecord._lastInputTime !== this.currentRecord._inputStartTime) {
                this.currentRecord.pauseCount++;
            }
            
            this.currentRecord._lastInputTime = now;
            this.currentRecord.charCount = charCount;
        }

        /**
         * 完成记录
         * 在自动保存完成时调用
         */
        finishRecord(saveType = 'pause') {
            if (!this.isEnabled || !this.currentRecord) return null;
            
            const endTime = performance.now();
            
            // 计算记录时长
            this.currentRecord.recordDuration = Math.round(
                endTime - this.currentRecord._inputStartTime
            );
            this.currentRecord.saveType = saveType;
            this.currentRecord.timestamp = new Date().toISOString();
            
            // 生成唯一 ID
            this.currentRecord.id = Date.now();
            
            // 保存到历史
            const record = { ...this.currentRecord };
            this.history.push(record);
            this._saveHistory();
            
            console.log('[Stats] 记录完成:', {
                字符数: record.charCount,
                首次输入延迟: record.firstInputDelay + 'ms',
                记录时长: record.recordDuration + 'ms',
                停顿次数: record.pauseCount,
                保存类型: record.saveType
            });
            
            // 清空当前记录
            this.currentRecord = null;
            
            return record;
        }

        /**
         * 取消当前记录（用户清空输入框但未保存）
         */
        cancelRecord() {
            this.currentRecord = null;
        }

        // ========== 统计聚合 ==========

        /**
         * 获取聚合统计数据
         */
        getAggregatedStats() {
            if (this.history.length === 0) {
                return {
                    totalRecords: 0,
                    avgFirstInputDelay: null,
                    avgRecordDuration: null,
                    avgCharCount: null,
                    avgPauseCount: null,
                    saveTypeDistribution: {},
                    recentRecords: []
                };
            }

            // 计算平均值
            let sumFirstInputDelay = 0;
            let sumRecordDuration = 0;
            let sumCharCount = 0;
            let sumPauseCount = 0;
            let validFirstInputCount = 0;
            const saveTypeCounts = {};

            this.history.forEach(record => {
                if (record.firstInputDelay !== null) {
                    sumFirstInputDelay += record.firstInputDelay;
                    validFirstInputCount++;
                }
                sumRecordDuration += record.recordDuration || 0;
                sumCharCount += record.charCount || 0;
                sumPauseCount += record.pauseCount || 0;
                
                const type = record.saveType || 'unknown';
                saveTypeCounts[type] = (saveTypeCounts[type] || 0) + 1;
            });

            const count = this.history.length;

            return {
                totalRecords: count,
                avgFirstInputDelay: validFirstInputCount > 0 
                    ? Math.round(sumFirstInputDelay / validFirstInputCount) 
                    : null,
                avgRecordDuration: Math.round(sumRecordDuration / count),
                avgCharCount: Math.round(sumCharCount / count * 10) / 10,
                avgPauseCount: Math.round(sumPauseCount / count * 10) / 10,
                saveTypeDistribution: saveTypeCounts,
                recentRecords: this.history.slice(-10).reverse()
            };
        }

        // ========== CSV 导出 ==========

        /**
         * 导出统计数据为 CSV 格式
         */
        exportToCSV() {
            if (this.history.length === 0) {
                console.warn('[Stats] 没有可导出的数据');
                return null;
            }

            // CSV 表头
            const headers = [
                'id',
                'timestamp',
                'first_input_delay_ms',
                'record_duration_ms',
                'char_count',
                'pause_count',
                'save_type'
            ];

            // CSV 数据行
            const rows = this.history.map(record => [
                record.id,
                record.timestamp,
                record.firstInputDelay !== null ? record.firstInputDelay : '',
                record.recordDuration !== null ? record.recordDuration : '',
                record.charCount || 0,
                record.pauseCount || 0,
                record.saveType || 'unknown'
            ]);

            // 组装 CSV
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => {
                    // 处理包含逗号或引号的值
                    if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
                        return `"${cell.replace(/"/g, '""')}"`;
                    }
                    return cell;
                }).join(','))
            ].join('\n');

            return {
                content: csvContent,
                filename: `quick-task-stats-${new Date().toISOString().slice(0, 10)}.csv`,
                recordCount: this.history.length
            };
        }

        /**
         * 下载 CSV 文件
         */
        downloadCSV() {
            const exportData = this.exportToCSV();
            if (!exportData) {
                alert('没有可导出的统计数据');
                return false;
            }

            // 创建 Blob
            const blob = new Blob(['\ufeff' + exportData.content], { 
                type: 'text/csv;charset=utf-8' 
            });
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = exportData.filename;
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 释放 URL
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            console.log('[Stats] 已导出', exportData.recordCount, '条统计记录到', exportData.filename);
            return true;
        }

        // ========== JSON 导出（匹配测试框架格式）==========

        /**
         * 导出聚合统计数据为 JSON 格式（匹配测试框架模板）
         */
        exportToJSON() {
            const stats = this.getAggregatedStats();
            
            // 匹配测试框架模板的字段格式
            const exportData = {
                exportTime: new Date().toISOString(),
                // 核心指标
                avgFirstInputDelay: stats.avgFirstInputDelay,
                totalRecords: stats.totalRecords,
                avgRecordDuration: stats.avgRecordDuration,
                avgCharCount: stats.avgCharCount,
                avgPauseCount: stats.avgPauseCount,
                // 保存类型分布
                saveTypeDistribution: stats.saveTypeDistribution,
                // 最近记录
                recentRecords: stats.recentRecords.map(r => ({
                    timestamp: r.timestamp,
                    firstInputDelay: r.firstInputDelay,
                    recordDuration: r.recordDuration,
                    charCount: r.charCount,
                    pauseCount: r.pauseCount,
                    saveType: r.saveType
                })),
                // 原始详细数据（供深度分析）
                rawData: this.history.map(r => ({
                    id: r.id,
                    timestamp: r.timestamp,
                    firstInputDelay: r.firstInputDelay,
                    recordDuration: r.recordDuration,
                    charCount: r.charCount,
                    pauseCount: r.pauseCount,
                    saveType: r.saveType
                }))
            };
            
            return {
                content: JSON.stringify(exportData, null, 2),
                filename: `quick-task-stats-${new Date().toISOString().slice(0, 10)}.json`,
                recordCount: this.history.length
            };
        }

        /**
         * 下载 JSON 文件
         */
        downloadJSON() {
            const exportData = this.exportToJSON();
            if (!exportData || this.history.length === 0) {
                alert('没有可导出的统计数据');
                return false;
            }

            // 创建 Blob
            const blob = new Blob([exportData.content], { 
                type: 'application/json;charset=utf-8' 
            });
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = exportData.filename;
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 释放 URL
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            console.log('[Stats] 已导出', exportData.recordCount, '条统计记录到', exportData.filename);
            return true;
        }

        // ========== 配置 ==========

        /**
         * 启用/禁用统计
         */
        setEnabled(enabled) {
            this.isEnabled = enabled;
            console.log('[Stats] 统计已', enabled ? '启用' : '禁用');
        }

        /**
         * 清除所有统计数据
         */
        clearAll() {
            this.history = [];
            this.currentRecord = null;
            localStorage.removeItem(STATS_KEY);
            console.log('[Stats] 所有统计数据已清除');
        }

        /**
         * 获取原始历史数据
         */
        getRawHistory() {
            return [...this.history];
        }
    }

    // ========== 创建全局实例 ==========
    const stats = new StatsManager();

    // 暴露到全局
    global.QuickTaskStats = {
        // 实例访问
        instance: stats,
        
        // 便捷方法
        startRecord: () => stats.startRecord(),
        recordInput: (charCount) => stats.recordInput(charCount),
        finishRecord: (saveType) => stats.finishRecord(saveType),
        cancelRecord: () => stats.cancelRecord(),
        getStats: () => stats.getAggregatedStats(),
        exportCSV: () => stats.downloadCSV(),
        exportJSON: () => stats.downloadJSON(),
        clear: () => stats.clearAll(),
        setEnabled: (enabled) => stats.setEnabled(enabled),
        
        // 调试用
        getRawHistory: () => stats.getRawHistory(),
        
        // 帮助
        help: () => {
            console.log(`
===== 快记统计模块 =====

API 方法:
  QuickTaskStats.startRecord()           开始一次新记录
  QuickTaskStats.recordInput(charCount)  记录输入事件
  QuickTaskStats.finishRecord(type)      完成记录（type: 'pause'|'max_interval'|'visibility'|'manual'）
  QuickTaskStats.cancelRecord()          取消当前记录
  QuickTaskStats.getStats()              获取聚合统计数据
  QuickTaskStats.exportCSV()             导出并下载 CSV 文件
  QuickTaskStats.clear()                 清除所有统计数据
  QuickTaskStats.setEnabled(false)       禁用统计

统计指标:
  - first_input_delay: 首次输入延迟（页面加载 → 首次按键）
  - record_duration: 记录时长（开始输入 → 保存完成）
  - char_count: 字符数
  - pause_count: 停顿次数（输入中断 > 300ms）
  - save_type: 保存类型（pause/max_interval/visibility/manual）

当前统计数据:
  总记录数: ${stats.history.length}
  平均首次输入延迟: ${stats.getAggregatedStats().avgFirstInputDelay || 'N/A'} ms
  平均记录时长: ${stats.getAggregatedStats().avgRecordDuration || 'N/A'} ms
=====================
            `);
        }
    };

})(window);
