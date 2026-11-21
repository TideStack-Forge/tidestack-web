import React from "react";
import { Renderer } from "amis";
import { Client } from "#ouroboros-host/utils/http";
import type { DatasetDevConfig } from "./types";
import "./DatasetTableBrowser.scss";

type TableColumn = { name: string; title?: string; dataType?: string };
type DataTable = {
  name: string;
  title?: string;
  source?: string;
  columns: TableColumn[];
};
type Props = {
  appName: string;
  datasource: string;
  testConnection?: DatasetDevConfig["testConnection"];
};
type State = {
  loading: boolean;
  error: string;
  tables: DataTable[];
  warnings: string[];
  search: string;
  selected: string;
};

class DatasetTableBrowser extends React.Component<Props, State> {
  state: State = {
    loading: true,
    error: "",
    tables: [],
    warnings: [],
    search: "",
    selected: "",
  };
  private disposed = false;

  componentDidMount() {
    void this.loadTables();
  }

  componentWillUnmount() {
    this.disposed = true;
  }

  loadTables = async () => {
    this.setState({ loading: true, error: "" });
    try {
      const response = await Client.post(
        "/api/dev/" +
          encodeURIComponent(this.props.appName) +
          "/dataset/datasource-tables",
        {
          datasource: this.props.datasource,
          testConnection: this.props.testConnection,
        },
        { isSilent: true },
      );
      if (response.data?.code !== 0) {
        throw new Error(response.data?.msg || "表结构读取失败");
      }
      if (this.disposed) return;
      const tables = response.data.data?.items || [];
      this.setState({
        loading: false,
        tables,
        warnings: response.data.data?.warnings || [],
        selected: tables[0]?.name || "",
      });
    } catch (error) {
      if (!this.disposed) {
        this.setState({
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  render() {
    const { loading, error, tables, warnings, search, selected } = this.state;
    if (loading) {
      return (
        <div className="dataset-table-browser-status" role="status">
          正在读取表结构…
        </div>
      );
    }
    if (error) {
      return (
        <div role="alert" className="alert alert-danger">
          {error}{" "}
          <button
            type="button"
            className="btn btn-default"
            onClick={this.loadTables}
          >
            重试
          </button>
        </div>
      );
    }
    const keyword = search.trim().toLowerCase();
    const matches = tables.filter((table) =>
      (table.name + " " + (table.title || "")).toLowerCase().includes(keyword),
    );
    const table = matches.find((item) => item.name === selected) || matches[0];
    return (
      <div className="dataset-table-browser">
        {warnings.length > 0 && (
          <div className="dataset-table-browser-notes" role="status">
            {warnings.join("；")}
          </div>
        )}
        <div className="dataset-table-browser-layout">
          <aside className="dataset-table-browser-list" aria-label="数据表">
            <label className="dataset-table-browser-search">
              <span>
                数据表{" "}
                <span className="dataset-table-browser-count">
                  {matches.length}
                </span>
              </span>
              <input
                type="search"
                className="form-control"
                placeholder="搜索表名或标题"
                value={search}
                onChange={(event) =>
                  this.setState({ search: event.target.value })
                }
              />
            </label>
            <div className="dataset-table-browser-tables">
              {matches.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  aria-pressed={item.name === table?.name}
                  onClick={() => this.setState({ selected: item.name })}
                >
                  <span className="dataset-table-browser-table-name">
                    {item.name}
                  </span>
                  {item.title && (
                    <span className="dataset-table-browser-table-title">
                      {item.title}
                    </span>
                  )}
                </button>
              ))}
              {!matches.length && (
                <div className="dataset-table-browser-status">
                  {tables.length ? "没有匹配的数据表" : "暂无可用数据表"}
                </div>
              )}
            </div>
          </aside>
          <section
            className="dataset-table-browser-detail"
            aria-label="字段结构"
          >
            {table && (
              <>
                <header>
                  <div>
                    <h3>{table.title || table.name}</h3>
                    <code>{table.name}</code>
                  </div>
                  <span>
                    {table.source === "model" ? "应用模型" : "数据库"} ·{" "}
                    {table.columns.length} 个字段
                  </span>
                </header>
                <div className="dataset-table-browser-fields">
                  <table>
                    <thead>
                      <tr>
                        <th>字段名</th>
                        <th>说明</th>
                        <th>数据类型</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.columns.map((column) => (
                        <tr key={column.name}>
                          <td>
                            <code>{column.name}</code>
                          </td>
                          <td>{column.title || "—"}</td>
                          <td>
                            <span className="dataset-table-browser-type">
                              {column.dataType || "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!table.columns.length && (
                  <div className="dataset-table-browser-status">
                    该表暂无字段
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    );
  }
}

Renderer({ type: "dataset-table-browser", autoVar: true })(
  DatasetTableBrowser as any,
);
export default DatasetTableBrowser;
