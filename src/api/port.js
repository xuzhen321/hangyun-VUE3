import request from './request'

/**
 * 港口搜索 —— 新增/修改订单时选起运港、目的港用(同一个接口,两个字段)。
 *
 * `keyword` **前缀匹配**「五字码 / 中文名 / 英文名」三个字段,任一命中即返回,最多 20 条。
 * 不是分页接口:data 直接是数组,不接受 page/size。
 *
 * ⚠️ 港口数据来自 `port-data.sql`(10 条模拟港口,其中 **1 条故意标成已删除**,
 *    所以搜得到 **9 条**)。库里没装这个文件的话返回**空数组** —— 不是接口坏了。
 */
export const searchPorts = keyword =>
  request.get('/ports/options', { params: { keyword: keyword || undefined } })
